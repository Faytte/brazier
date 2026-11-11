
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
window.__users[1].character={id:'hero',uuid:'Actor.hero',name:'Alice Hero',type:'character',level:15};
window.game.system={id:'pf2e'};window.game.items=[];window.game.actors=[];window.game.packs=[];
window.ui={notifications:{info(){},warn(msg){window.__errors.push('NOTICE: '+msg)},error(msg){window.__errors.push('ERROR: '+msg)}}};
window.Hooks={events:{},once(name,cb){(this.events[name]??=[]).push(cb)},on(name,cb){(this.events[name]??=[]).push(cb)}};
window.ChatMessage={getSpeaker(){return{}},async create(){return{}}};
let previewDocSequence=0;
window.JournalEntry=class {
  constructor(data){this.id='j'+(++previewDocSequence);this.name=data.name;this.flags=structuredClone(data.flags);this.ownership=structuredClone(data.ownership)}
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
window.__source=new Item({name:'Healing Potion',type:'consumable',img:'',ownership:{default:2},flags:{},system:{level:{value:1},category:'potion',traits:{rarity:'common',value:['consumable','healing','magical']},description:{value:'<p>Restore health.</p><section class="secret">GM ONLY</section>'}}});
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
// Additional APIs used by the campaign preview; all are explicitly simulated.
for(const values of [game.users,game.actors,game.items]){values.get??=function(id){return this.find(v=>v.id===id)};values.has??=function(id){return this.some(v=>v.id===id)};}
window.__sheetPreview=doc=>{
 const old=document.getElementById('preview-sheet');if(old)old.remove();const dialog=document.createElement('dialog');dialog.id='preview-sheet';
 const title=document.createElement('h2');title.textContent=doc.name+' · Simulated sheet';dialog.append(title);const boundary=document.createElement('p');boundary.textContent='Native PF2E sheet handoff simulated. Its actual inventory controls and transfers require a running PF2E world.';dialog.append(boundary);
 const text=document.createElement('pre');const parsed=new DOMParser().parseFromString(doc.system?.description?.value??'', 'text/html');parsed.querySelectorAll('.secret,script,style').forEach(el=>el.remove());text.textContent=doc.items?[...doc.items].map(i=>`${i.name} × ${i.system.quantity??1}`).join('\n'):parsed.body.textContent;dialog.append(text);
 const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(close);document.body.append(dialog);dialog.showModal();
};
Item.prototype.toObject=function(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags??{}),ownership:structuredClone(this.ownership??{}),_stats:structuredClone(this._stats??{})};};
const oldItemUpdate=Item.prototype.update;
Item.prototype.update=async function(data){await oldItemUpdate.call(this,data);return this;};
const patch=(doc,data)=>{for(const [path,value]of Object.entries(data)){if(path==='_id')continue;const parts=path.split('.');let target=doc;for(const p of parts.slice(0,-1))target=target[p]??={};target[parts.at(-1)]=structuredClone(value);}};
window.PreviewActor=class {
 constructor({id,name,type='character',level=15,ownership={default:0},items=[]}){
  this.id=id;this.uuid='Actor.'+id;this.name=name;this.type=type;this.level=level;this.ownership=ownership;this.flags={};this.system={details:{level:{value:level}},traits:{size:'med'}};this.items=items;
  this.sheet={options:{viewPermission:'LIMITED'},render:async(force,options)=>{window.__lastNativeSheet={actorUuid:this.uuid,force,options};return __sheetPreview(this);}};this.items.get=id=>this.items.find(i=>i.id===id);this.inventory={coins:{gp:140,sp:5,cp:0,pp:0}};
 }
 get isOwner(){return this.testUserPermission(game.user,'OWNER')}
 getFlag(scope,key){return this.flags[scope]?.[key]}
 async setFlag(scope,key,value){this.flags[scope]??={};this.flags[scope][key]=structuredClone(value);return this;}
 testUserPermission(user,level){return user.isGM||(this.ownership[user.id]??this.ownership.default??0)>=(typeof level==='number'?level:level==='OWNER'?3:level==='LIMITED'?1:2)}
 async update(data){patch(this,data);return this;}
 async createEmbeddedDocuments(type,sources,{keepId=false}={}){
  const created=[];for(const source of sources){const id=keepId?source._id:crypto.randomUUID().replaceAll('-','').slice(0,16);if(this.items.some(i=>i.id===id))throw Error('Duplicate embedded ID');const item=new Item({...source,ownership:this.ownership});item.id=id;item.uuid=`${this.uuid}.Item.${id}`;item._source=structuredClone(source);item.sheet={render:async()=>__sheetPreview(item)};this.items.push(item);created.push(item);}return created;
 }
 async updateEmbeddedDocuments(type,updates){for(const data of updates){const item=this.items.find(i=>i.id===data._id);if(!item)throw Error('Item missing');patch(item,data);item._source={system:structuredClone(item.system)};}return updates;}
 async deleteEmbeddedDocuments(type,ids){for(const id of ids){const index=this.items.findIndex(i=>i.id===id);if(index>=0)this.items.splice(index,1);}return ids;}
};
