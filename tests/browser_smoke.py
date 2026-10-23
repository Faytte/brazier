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
  filter(cb){return window.__docs.filter(d=>window.game.user.isGM || ((d.ownership?.[window.game.user.id]??0)>=2)).filter(cb)},
  [Symbol.iterator](){return window.__docs[Symbol.iterator]()}
}, messages:{contents:[]}, modules:new Map([['brazier',{}]]),keybindings:{register(){}}};
window.ui={notifications:{info(){},warn(msg){window.__errors.push('NOTICE: '+msg)},error(msg){window.__errors.push('ERROR: '+msg)}}};
window.Hooks={events:{},once(name,cb){(this.events[name]??=[]).push(cb)},on(name,cb){(this.events[name]??=[]).push(cb)}};
window.ChatMessage={getSpeaker(){return{}},async create(){return{}}};
window.JournalEntry=class {
  constructor(data){this.id='j'+(window.__docs.length+1);this.name=data.name;this.flags=structuredClone(data.flags);this.ownership=structuredClone(data.ownership)}
  static async create(data){const doc=new JournalEntry(data);window.__docs.push(doc);return doc}
  getFlag(scope,key){return this.flags?.[scope]?.[key]}
  testUserPermission(user,perm){return user.isGM || (this.ownership?.[user.id]??0)>=2}
  async update(data){this.name=data.name??this.name;this.ownership=data.ownership??this.ownership;
    for(const [key,val] of Object.entries(data))if(key.startsWith('flags.')){
       const [,scope,flag]=key.split('.');this.flags[scope]??={};this.flags[scope][flag]=structuredClone(val)}return this}
  async delete(){window.__docs.splice(window.__docs.indexOf(this),1)}
};
const fixture=`<div class="brazier-root">
<header class="brazier-topbar"><span class="brazier-brand">BRAZIER</span><nav class="brazier-tabs"><button type="button" data-act="tab" data-value="trees">Skill Trees</button><button type="button" data-act="tab" data-value="boons">Benison Boons</button><button type="button" data-act="tab" data-value="curio">Curio</button><button type="button" data-act="tab" data-value="caravan">Caravan</button></nav></header>
<section class="brazier-workspace"><aside class="brazier-rail"><button data-act="rail">TREES</button></aside>
<section class="brazier-main"><div class="brazier-stage" data-bg="ember" tabindex="0">
<div class="brazier-world"><svg class="brazier-edges" viewBox="-2500 -2500 5000 5000"></svg><div class="brazier-nodes"></div></div>
<div class="brazier-zoom"><button data-act="zoomout">-</button><span class="brazier-zoomvalue">100%</span><button data-act="zoomin">+</button><button data-act="fit">Fit</button></div><div class="brazier-overlay"></div></div></section></section></div>`;
window.foundry={applications:{api:{
  ApplicationV2:class {
    constructor(options={}){this.options=options;this.rendered=false;this.element=document.createElement('div');this.element.className='brazier-window';this.element.style.width='1160px';this.element.style.height='750px';this.element.innerHTML=fixture;document.body.appendChild(this.element)}
    async _prepareContext(){return{}}
    async _onRender(){}
    async render(){await this._prepareContext({});this.rendered=true;await this._onRender({},{});return this}
  },HandlebarsApplicationMixin:Base=>Base}, apps:{FilePicker:class{async render(){}}}}};
'''

def dataurl(source):
    return 'data:text/javascript;base64,'+base64.b64encode(source.encode('utf-8')).decode('ascii')
model_url=dataurl((ROOT/'scripts/model.mjs').read_text())
store_url=dataurl((ROOT/'scripts/store.mjs').read_text().replace('./model.mjs',model_url))
app_url=dataurl((ROOT/'scripts/app.mjs').read_text().replace('./model.mjs',model_url).replace('./store.mjs',store_url))
main_url=dataurl((ROOT/'scripts/main.mjs').read_text().replace('./app.mjs',app_url).replace('./store.mjs',store_url))
with sync_playwright() as playwright:
    # Use Playwright's installed Chromium by default, or an explicit system browser.
    browser=playwright.chromium.launch(executable_path=os.environ.get('BRAZIER_CHROMIUM_PATH'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':980})
    js_errors=[]
    page.on('pageerror',lambda e:js_errors.append(str(e)))
    page.set_content('<html><head></head><body></body></html>')
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
    launcher=page.evaluate('''async(mainUrl)=>{
      game.user=__users[0];
      const sidebar=document.createElement('div');sidebar.id='sidebar-tabs';document.body.append(sidebar);
      await import(mainUrl);
      for(const cb of Hooks.events.init??[])await cb();
      for(const cb of Hooks.events.ready??[])await cb();
      const btn=document.querySelector('#brazier-launcher');
      return {button:!!btn,sidebar:btn?.parentNode===sidebar,api:typeof game.modules.get('brazier').api.open};
    }''',main_url)
    assert launcher=={'button':True,'sidebar':True,'api':'function'},launcher
    # Re-rendering the same root/canvas must not accumulate duplicate click handlers.
    handler_count=page.evaluate('''async()=>{
      const app=window.__app;let clicks=0;
      app._onClick=()=>{clicks++};
      await app._onRender({},{});await app._onRender({},{});
      app.element.querySelector('[data-act="rail"]').click();
      return clicks;
    }''')
    assert handler_count==1,('duplicate delegated click handlers',handler_count)
    # Late sidebar mount should relocate the existing button (not leave a floating one).
    rehome=page.evaluate('''async()=>{
      const old=document.querySelector('#sidebar-tabs');
      const btn=document.querySelector('#brazier-launcher');document.body.append(btn);old.remove();btn.classList.remove('in-sidebar');
      const other=document.createElement('div');other.id='sidebar-tabs';document.body.append(other);
      for(const cb of Hooks.events.renderSidebar??[])await cb();
      await new Promise(queueMicrotask);
      return btn.parentNode===other&&btn.classList.contains('in-sidebar');
    }''')
    assert rehome,'launcher did not relocate to newly mounted sidebar'
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
    browser.close()
    print('Brazier Chromium DOM/CSS/pan/zoom/editor smoke tests: PASSED')
    print('Canvas share of width: %.1f%%'%(100*result['stageWidth']/result['windowWidth']))
