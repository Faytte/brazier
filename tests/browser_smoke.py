"""Headless Chromium UI smoke test with a *mock* Foundry ApplicationV2 host.
This exercises real UI JS and CSS, but cannot replace a licensed Foundry client.
Run from any directory: python tests/browser_smoke.py
"""
from __future__ import annotations
import http.server
import socketserver
import threading
import base64
import os
from pathlib import Path
from contextlib import contextmanager
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

@contextmanager
def server():
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)
        def log_message(self, *_args): pass
    with socketserver.TCPServer(('127.0.0.1',0), Handler) as srv:
        worker=threading.Thread(target=srv.serve_forever,daemon=True)
        worker.start()
        try: yield f'http://127.0.0.1:{srv.server_address[1]}'
        finally: srv.shutdown();worker.join(timeout=2)

BOOTSTRAP = r'''
window.__errors=[];
window.addEventListener('error',e=>window.__errors.push(e.message));
window.addEventListener('unhandledrejection',e=>window.__errors.push(String(e.reason)));
window.__docs=[];
window.__users=[{id:'gm',name:'GM',isGM:true,active:true},{id:'alice',name:'Alice',isGM:false,active:true}];
window.__users.get=function(id){return this.find(x=>x.id===id)};
window.__users.has=function(id){return this.some(x=>x.id===id)};
window.game={user:window.__users[0], users:window.__users, journal:{
  filter(cb){return window.__docs.filter(d=>window.game.user.isGM || ((d.ownership?.[window.game.user.id]??d.ownership?.default??0)>=2)).filter(cb)},
  [Symbol.iterator](){return window.__docs[Symbol.iterator]()}
}, messages:{contents:[]}, modules:new Map([['brazier',{}]]),keybindings:{register(){}}};
window.game.system={id:'pf2e'};window.game.items=[];window.game.actors=[];window.game.packs=[];
window.ui={notifications:{info(){},warn(msg){window.__errors.push('NOTICE: '+msg)},error(msg){window.__errors.push('ERROR: '+msg)}}};
window.Hooks={events:{},once(name,cb){(this.events[name]??=[]).push(cb)},on(name,cb){(this.events[name]??=[]).push(cb)}};
window.ChatMessage={getSpeaker(){return{}},async create(){return{}}};
window.JournalEntry=class {
  constructor(data){this.id='j'+(window.__docs.length+1);this.name=data.name;this.flags=structuredClone(data.flags);this.ownership=structuredClone(data.ownership)}
  static async create(data){const doc=new JournalEntry(data);window.__docs.push(doc);return doc}
  getFlag(scope,key){return this.flags?.[scope]?.[key]}
  testUserPermission(user,perm){return user.isGM || (this.ownership?.[user.id]??this.ownership?.default??0)>=2}
  async update(data){this.name=data.name??this.name;this.ownership=data.ownership??this.ownership;
    for(const [key,val] of Object.entries(data))if(key.startsWith('flags.')){
       const [,scope,flag]=key.split('.');this.flags[scope]??={};this.flags[scope][flag]=structuredClone(val)}return this}
  async delete(){window.__docs.splice(window.__docs.indexOf(this),1)}
};
window.Item=class extends JournalEntry {
  constructor(data){super(data);this.id='item'+(game.items.length+1);this.type=data.type;this.img=data.img;this.system=structuredClone(data.system);this.documentName='Item';this.sheet={render:async()=>{}};}
  static async create(data){const item=new Item(data);game.items.push(item);return item;}
  isOfType(type){return this.type===type;}
  async update(data){await super.update(data);for(const [key,value] of Object.entries(data)){
    if(key==='img')this.img=value;
    if(key.startsWith('system.')){const parts=key.split('.');let target=this;for(const part of parts.slice(0,-1))target=target[part]??={};target[parts.at(-1)]=structuredClone(value);}
  }return this;}
};
window.__source=new Item({name:'Healing Potion',type:'consumable',img:'',ownership:{default:2},flags:{},system:{level:{value:1},category:'potion',traits:{rarity:'common',value:['healing','magical']},description:{value:'<p>Restore health.</p><section class="secret">GM ONLY</section>'}}});
window.fromUuid=async(uuid)=>uuid==='Compendium.pf2e.equipment-srd.Item.potion'?__source:null;
window.__rune=new Item({name:'Flaming',type:'equipment',img:'',ownership:{default:2},flags:{},system:{usage:{value:'etched-onto-a-weapon'},level:{value:8},traits:{rarity:'common',value:['fire','magical']},description:{value:'Fire rune'}}});
const potionUuid='Compendium.pf2e.equipment-srd.Item.potion';window.fromUuid=async(uuid)=>uuid===potionUuid?__source:uuid==='Compendium.pf2e.equipment-srd.Item.XszNvxnymWYRaoTp'?__rune:null;
game.packs=[{documentName:'Item',collection:'pf2e.equipment-srd',visible:true,metadata:{label:'PF2E Equipment'},getIndex:async()=>[{_id:'potion',name:'Healing Potion',type:'consumable',system:__source.system},{_id:'XszNvxnymWYRaoTp',name:'Flaming',type:'equipment',system:__rune.system},{_id:'fundamental',name:'Weapon Potency +1',type:'equipment',system:{usage:{value:'etched-onto-a-weapon'},level:{value:2},traits:{value:['magical']}}}]}];
window.foundry={applications:{api:{
  ApplicationV2:class {
    constructor(options={}){this.options=options;this.rendered=false;this.element=document.createElement('div');this.element.className='brazier-window';this.element.style.width='1160px';this.element.style.height='750px';document.body.appendChild(this.element)}
    async _prepareContext(){return{}}
    async _onRender(){}
    async render(){
      const context=await this._prepareContext({});
      const holder=document.createElement('div');holder.innerHTML=Handlebars.compile(window.__template)(context);
      const part=holder.firstElementChild;
      // Model root-part child replacement, which the former fixture did not exercise.
      this.element.replaceChildren(...(this.constructor.PARTS.body.root?[...part.childNodes]:[part]));
      this.rendered=true;await this._onRender(context,{});return this;
    }
  },HandlebarsApplicationMixin:Base=>Base}, apps:{FilePicker:class{async render(){}}}}};
'''

def dataurl(source):
    return 'data:text/javascript;base64,'+base64.b64encode(source.encode('utf-8')).decode('ascii')
model_url=dataurl((ROOT/'scripts/model.mjs').read_text())
store_url=dataurl((ROOT/'scripts/store.mjs').read_text().replace('./model.mjs',model_url))
rune_url=dataurl((ROOT/'scripts/rune-reference.mjs').read_text())
perspective_url=dataurl((ROOT/'scripts/perspective.mjs').read_text())
catalog_url=dataurl((ROOT/'scripts/catalog.mjs').read_text().replace('./model.mjs',model_url).replace('./rune-reference.mjs',rune_url))
catalog_ui_url=dataurl((ROOT/'scripts/catalog-ui.mjs').read_text().replace('./model.mjs',model_url).replace('./catalog.mjs',catalog_url).replace('./perspective.mjs',perspective_url))
app_url=dataurl((ROOT/'scripts/app.mjs').read_text().replace('./model.mjs',model_url).replace('./store.mjs',store_url).replace('./catalog-ui.mjs',catalog_ui_url).replace('./perspective.mjs',perspective_url))
main_url=dataurl((ROOT/'scripts/main.mjs').read_text().replace('./app.mjs',app_url).replace('./store.mjs',store_url).replace('./catalog.mjs',catalog_url).replace('./perspective.mjs',perspective_url))
with sync_playwright() as playwright:
    # Use Playwright's installed Chromium by default, or an explicit system browser.
    browser=playwright.chromium.launch(executable_path=os.environ.get('BRAZIER_CHROMIUM_PATH'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':980})
    js_errors=[]
    page.on('pageerror',lambda e:js_errors.append(str(e)))
    page.set_content('<html><head></head><body></body></html>')
    page.add_script_tag(path=str(ROOT/'tests/vendor/handlebars.js'))
    page.evaluate('(template)=>window.__template=template',(ROOT/'templates/window.hbs').read_text())
    page.evaluate('()=>{'+BOOTSTRAP+'}')
    page.add_style_tag(content=(ROOT/'styles/brazier.css').read_text())
    urls={'modelUrl':model_url,'appUrl':app_url}
    page.evaluate('(urls)=>window.__urls=urls',{'modelUrl':model_url,'storeUrl':store_url})
    result=page.evaluate('''async ({modelUrl,appUrl})=>{
      const {freshTree,freshNode}=await import(modelUrl);
      const {BrazierApplication}=await import(appUrl);
      const tree=freshTree('Compass Rose');tree.access='all';tree.shared.points=10;
      const west=freshNode('West',-200,0),east=freshNode('East',200,0),
        north=freshNode('North',0,-200),south=freshNode('South',0,200),center=freshNode('Center',0,0);
      for(const leaf of [west,east,north,south])leaf.requires=[center.id];
      tree.nodes=[center,west,east,north,south];
      const master=await JournalEntry.create({name:'Brazier • Compass Rose',ownership:{default:0},flags:{brazier:{data:{kind:'master',tree}}}});
      const app=new BrazierApplication();app.treeId=tree.id;app.editing=true;
      await app.render({force:true});
      const stage=app.element.querySelector('.brazier-stage');
      const world=stage.querySelector('.brazier-world');
      const results={nodeCount:stage.querySelectorAll('.brazier-node').length,paths:stage.querySelectorAll('path').length,
        stageWidth:stage.getBoundingClientRect().width,windowWidth:app.element.getBoundingClientRect().width,
        labels:[...stage.querySelectorAll('.brazier-node-caption')].map(n=>n.textContent),
        center:world.style.transform};
      window.__app=app;window.__tree=tree;window.__master=master;
      return results;
    }''',urls)
    assert result['nodeCount']==5, result
    assert result['paths']==4, result
    assert result['stageWidth']>=result['windowWidth']*0.75, result
    assert all(d in result['labels'] for d in ['North','South','East','West','Center']),result
    # Locked talents must mask connectors exactly like available/unlocked talents.
    opacity=page.evaluate('''()=>{
      const symbols=[...__app.element.querySelectorAll('.brazier-node-symbol')];
      return {locked:__app.element.querySelectorAll('.brazier-node.locked').length,
        transparent:symbols.some(el=>getComputedStyle(el).opacity!=='1'||getComputedStyle(el.parentElement).opacity!=='1'),
        backgrounds:symbols.every(el=>!getComputedStyle(el).backgroundImage.includes('rgba('))};
    }''')
    assert opacity['locked']>0 and not opacity['transparent'] and opacity['backgrounds'],opacity
    stage=page.locator('.brazier-stage')
    initial_zoom=page.locator('.brazier-zoomvalue').inner_text()
    stage.hover(position={'x':400,'y':450})
    page.mouse.wheel(0,-250)
    page.wait_for_timeout(80)
    zoom=page.locator('.brazier-zoomvalue').inner_text()
    assert initial_zoom=='100%' and zoom!='100%',(initial_zoom,zoom)
    # Drag empty stage in player/canvas mode; pan moves without modifying node positions.
    initial_pan=page.evaluate('window.__app.pan.x')
    rect=stage.bounding_box()
    px=rect['x']+100;py=rect['y']+200
    page.mouse.move(px,py);page.mouse.down();page.mouse.move(px+60,py+35,steps=6);page.mouse.up()
    new_pan=page.evaluate('window.__app.pan.x')
    assert new_pan!=initial_pan,(initial_pan,new_pan)
    # Click an existing node once; native click must be single selection rather than double selection.
    selected=page.evaluate('''async()=>{
      const app=window.__app;
      let count=0;const original=app._selectNode.bind(app);
      app._selectNode=async id=>{count++;return original(id)};
      app._onClick({target:app.element.querySelector('.brazier-node')});
      return {count,nodeId:app.nodeId,panel:app.panel};
    }''')
    assert selected['count']==1 and selected['panel']=='node',selected
    # Real pointer/mouse events: one click selects once; a dragged talent persists its new coordinates.
    actual_click=page.evaluate('''()=>{const a=window.__app;window.__clicks=0;
      const original=a._selectNode.bind(a);a._selectNode=async id=>{window.__clicks++;return original(id)};}''')
    page.locator('.brazier-node').first.click(force=True)
    page.wait_for_timeout(50)
    assert page.evaluate('window.__clicks')==1,('A physical click must not double-select a node',page.evaluate('window.__clicks'))
    before_xy=page.evaluate('window.__master.getFlag("brazier","data").tree.nodes[0].x')
    target=page.locator('.brazier-node').first.bounding_box()
    x=target['x']+target['width']/2;y=target['y']+target['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+85,y+40,steps=6);page.mouse.up()
    page.wait_for_timeout(80)
    after_xy=page.evaluate('window.__master.getFlag("brazier","data").tree.nodes[0].x')
    assert before_xy!=after_xy,(before_xy,after_xy)
    # Test browser-local DOM path: selecting changes overlay, changing a node field persists in mock DB.
    changed=page.evaluate('''async()=>{
      const app=window.__app;
      const input=app.element.querySelector('[data-field="node.name"]');
      input.value='Renamed Center';
      await app._onChange({target:input});
      return window.__master.getFlag('brazier','data').tree.nodes[0].name;
    }''')
    assert changed=='Renamed Center',changed
    # Player view gets projection only. No unassigned-tree content is returned or rendered.
    private_access=page.evaluate('''async()=>{
      const {freshTree,freshNode}=await import(window.__urls.modelUrl);
      const {availableTrees}=await import(window.__urls.storeUrl);
      const privateTree=freshTree('UNAUTHORIZED SECRET');privateTree.access='selected';privateTree.users=['nobody'];
      privateTree.nodes=[freshNode('Top Secret',0,0)];
      await JournalEntry.create({name:'Private Master',ownership:{default:0},flags:{brazier:{data:{kind:'master',tree:privateTree}}}});
      game.user=__users[1];
      const playerTrees=availableTrees();
      const safe=JSON.stringify(playerTrees);
      return {count:playerTrees.length,leaked:safe.includes('Top Secret')||safe.includes('UNAUTHORIZED SECRET')};
    }''')
    assert private_access['count']==1 and not private_access['leaked'],private_access
    native_tool=page.evaluate('''async(mainUrl)=>{
      game.user=__users[0];
      await import(mainUrl);
      for(const cb of Hooks.events.init??[])await cb();
      for(const cb of Hooks.events.ready??[])await cb();
      const select={name:'select',order:0};
      const controls={tokens:{tools:{select}},lighting:{tools:{}}};
      for(const cb of Hooks.events.getSceneControlButtons??[])cb(controls);
      for(const cb of Hooks.events.getSceneControlButtons??[])cb(controls);
      window.__nativeTool=controls.tokens.tools.brazier;
      game.user=__users[1];
      const player={tokens:{tools:{select}}};
      for(const cb of Hooks.events.getSceneControlButtons??[])cb(player);
      for(const cb of Hooks.events.getSceneControlButtons??[])cb({});
      game.user=__users[0];
      return {toolCount:Object.keys(controls.tokens.tools).length,preservesSelect:controls.tokens.tools.select===select,
        button:__nativeTool.button,visible:__nativeTool.visible,playerVisible:player.tokens.tools.brazier.visible,
        order:__nativeTool.order,handler:typeof __nativeTool.onChange,
        floating:!!document.querySelector('#brazier-launcher'),api:typeof game.modules.get('brazier').api.open};
    }''',main_url)
    assert native_tool=={'toolCount':2,'preservesSelect':True,'button':True,'visible':True,
      'playerVisible':True,'order':1,'handler':'function','floating':False,'api':'function'},native_tool
    # Re-rendering the same root/canvas must not accumulate duplicate click handlers.
    handler_count=page.evaluate('''async()=>{
      const app=window.__app;let clicks=0;
      app._onClick=()=>{clicks++};
      await app._onRender({},{});await app._onRender({},{});
      app.element.querySelector('[data-act="rail"]').click();
      return clicks;
    }''')
    assert handler_count==1,('duplicate delegated click handlers',handler_count)
    # HTML and custom image fields must not inject active markup into node views.
    injection=page.evaluate('''()=>{
      game.user=__users[0];const app=__app,tree=__master.getFlag('brazier','data').tree;
      tree.nodes[0].name='<img src=x onerror=alert(1)>';
      tree.nodes[0].description='<svg onload=alert(1)>private</svg>';
      tree.nodes[0].iconUrl='javascript:alert(1)';
      app.nodeId=tree.nodes[0].id;app.panel='node';app.editing=false;app._renderGraph();
      return {caption:app.element.querySelector('.brazier-node-caption')?.textContent,
        injected:!!app.element.querySelector('.brazier-node-caption img, .brazier-inspector svg, .brazier-inspector img[src^="javascript"]')};
    }''')
    assert '<img' in injection['caption'] and not injection['injected'],injection
    # A narrower window must leave a useful pan/zoom canvas, not collapse under sidebars.
    page.set_viewport_size({'width':780,'height':640})
    narrow=page.evaluate('''()=>{
      __app.element.style.width='735px';__app.element.style.height='540px';
      const r=__app.element.getBoundingClientRect(),s=__app.element.querySelector('.brazier-stage').getBoundingClientRect();
      return {fraction:s.width/r.width,canvasHeight:s.height};
    }''')
    assert narrow['fraction']>=0.77 and narrow['canvasHeight']>=240,narrow
    errors=page.evaluate('window.__errors')
    assert not js_errors and not errors,(js_errors,errors)
    # Exercise real top-level template buttons through native browser clicks.
    # This fails when root:true discards .brazier-root and event binding returns early.
    page.set_viewport_size({'width':1500,'height':980})
    baseline=page.evaluate('''async(appUrl)=>{
      document.querySelectorAll('.brazier-window').forEach(el=>el.remove());
      const {BrazierApplication}=await import(appUrl);
      window.__regressionApp=new BrazierApplication();await __regressionApp.render({force:true});
      return __docs.filter(d=>d.getFlag('brazier','data')?.kind==='master').length;
    }''',app_url)
    for value,title in [('boons','Benison Boons'),('curio','Curio'),('caravan','Caravan')]:
      page.locator(f'[data-act="tab"][data-value="{value}"]').click()
      page.locator('.brazier-root h2').filter(has_text='Consumables' if value=='boons' else title).first.wait_for()
      assert page.evaluate('window.__regressionApp.tab')==value
    page.locator('[data-act="tab"][data-value="curio"]').click()
    page.locator('[data-cat-act="new-curio"]').click()
    page.locator('[data-cat-field="curio.name"]').fill('Moon Relic')
    page.locator('[data-cat-field="curio.description"]').fill('SECRET CURIO DETAILS')
    page.locator('[data-cat-act="add-gift"]').click()
    page.locator('[data-cat-field="gift.name"]').fill('Moon Gift')
    page.locator('[data-cat-field="gift.description"]').fill('PRIVATE GIFT EFFECT')
    page.locator('[data-cat-field="curio.users"]').check()
    page.locator('[data-cat-act="save-curio"]').click()
    page.wait_for_function('()=>game.items.length===1')
    item_id=page.evaluate('game.items[0].id')
    page.locator('[data-cat-field="curio.name"]').fill('Moon Relic Updated')
    page.locator('[data-cat-act="save-curio"]').click()
    page.wait_for_function('()=>game.items[0].name==="Moon Relic Updated"')
    assert page.evaluate('game.items.length')==1 and page.evaluate('game.items[0].id')==item_id
    page.locator('[data-cat-act="browse-gifts"]').click()
    page.locator('[data-cat-act="load-items"]').click()
    page.locator('[data-cat-act="choose-gift"][data-value$=".potion"]').click()
    assert page.locator('[data-cat-field="gift.name"]').input_value()=='Healing Potion'
    assert 'GM ONLY' not in page.locator('[data-cat-field="gift.description"]').input_value()
    page.locator('[data-act="tab"][data-value="boons"]').click()
    assert page.locator('[data-cat-act="load-items"]').count()==0
    page.locator('[data-cat-act="catalog-mode"][data-value="manage"]').click()
    page.locator('[data-cat-act="load-items"]').click()
    assert page.locator('.brazier-trait-option[data-trait-name="fire"]').count()==0
    page.locator('[data-cat-field="filter.traits"][data-trait="healing"]').check()
    page.locator('[data-cat-field="filter.traits"][data-trait="magical"]').check()
    assert page.locator('[data-cat-field="filter.traits"]:checked').count()==2
    page.locator('[data-cat-act="clear-traits"]').click()
    page.locator('[data-cat-act="add-consumable"]').click()
    page.locator('[data-cat-field="boons.count"]').fill('3')
    page.locator('[data-cat-act="save-boon-count"]').click()
    page.wait_for_function('()=>__docs.some(d=>d.getFlag("brazier","catalog")?.boons?.consumableCount===3)')
    assert page.locator('.brazier-curated-list').inner_text().count('Healing Potion')==1
    for section in ['memories']:
      page.locator(f'[data-cat-act="boon-section"][data-value="{section}"]').click()
      page.locator('[data-cat-field="boons.optionName"]').fill('Test '+section)
      page.locator('[data-cat-act="add-boon-option"]').click()
      page.locator('.brazier-curated-list').filter(has_text='Test '+section).wait_for()
    page.locator('[data-cat-act="boon-section"][data-value="runes"]').click()
    assert page.locator('.brazier-search-results').inner_text().count('Flaming')==1
    assert 'Weapon Potency' not in page.locator('.brazier-search-results').inner_text()
    page.locator('[data-cat-act="add-rune"]').click()
    page.locator('[data-cat-act="catalog-mode"][data-value="overview"]').click()
    assert page.locator('[data-cat-act="load-items"]').count()==0
    page.locator('[data-view-as]').select_option('alice')
    assert page.locator('[data-cat-act="catalog-mode"]').count()==0
    page.locator('[data-cat-act="toggle-choice"]').click()
    page.locator('[data-cat-act="save-choices"]').click()
    page.wait_for_function('()=>__docs.some(d=>d.getFlag("brazier","catalog")?.choices?.runes?.length===1)')
    page.locator('[data-act="return-storyteller"]').click()
    assert page.locator('[data-cat-act="catalog-mode"]').count()==2
    print('Catalog overview/management, property rune exclusion, player perspective and saved player choices: PASSED')
    page.locator('[data-act="tab"][data-value="trees"]').click()
    page.locator('[data-act="new-tree"]').click()
    page.wait_for_function('(before)=>__docs.filter(d=>d.getFlag("brazier","data")?.kind==="master").length===before+1',arg=baseline)
    page.locator('[data-act="add-node"]').wait_for()
    before_nodes=page.evaluate('window.__regressionApp.tree.nodes.length')
    page.locator('[data-act="add-node"]').click()
    page.wait_for_function('(before)=>__regressionApp.tree.nodes.length===before+1',arg=before_nodes)
    page.locator('[data-act="tree-settings"]').click()
    page.locator('[data-field="tree.name"]').wait_for()
    print('Real Handlebars template: tab clicks, New Tree, Add Talent, Tree Settings: PASSED')
    opened=page.evaluate('''async()=>{
      const before=document.querySelectorAll('.brazier-window').length;
      await __nativeTool.onChange(new Event('click'),true);
      return document.querySelectorAll('.brazier-window').length===before+1;
    }''')
    assert opened,'Native Token Controls button did not open Brazier'
    print('Native Token Controls registration/action and opaque talent symbols: PASSED')
    browser.close()
    print('Brazier Chromium DOM/CSS/pan/zoom/editor smoke tests: PASSED')
    print('Canvas share of width: %.1f%%'%(100*result['stageWidth']/result['windowWidth']))
