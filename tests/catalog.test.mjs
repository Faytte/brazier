import assert from 'node:assert/strict';
import {clone} from '../scripts/model.mjs';
import * as catalog from '../scripts/catalog.mjs';
const journals=[],items=[],actorItems=[];let sequence=0;
const users=[{id:'gm',isGM:true},{id:'alice',isGM:false},{id:'bob',isGM:false}];users.get=id=>users.find(u=>u.id===id);
const readable=(d,u)=>u.isGM||(d.ownership[u.id]??d.ownership.default??0)>=2;
class Doc{
 constructor(d){Object.assign(this,clone(d));this.id=`id${++sequence}`;this.documentName=d.type?'Item':'JournalEntry';this.system??={};}
 getFlag(s,k){return this.flags?.[s]?.[k];}
 testUserPermission(u){return readable(this,u);}
 async update(d){assert(game.user.isGM);for(const [k,v] of Object.entries(d)){const keys=k.split('.');let t=this;for(const part of keys.slice(0,-1))t=t[part]??={};t[keys.at(-1)]=clone(v);}return this;}
 isOfType(type){return this.type===type;}
}
globalThis.game={user:users[0],users,system:{id:'pf2e'},journal:{filter:cb=>journals.filter(d=>readable(d,game.user)).filter(cb)},items,actors:[{items:actorItems}],packs:[]};
globalThis.JournalEntry={async create(d){assert(game.user.isGM);const doc=new Doc(d);journals.push(doc);return doc;}};
globalThis.Item={async create(d){const doc=new Doc(d);items.push(doc);return doc;}};
globalThis.ui={notifications:{warn(){}}};
const source=new Doc({name:'Healing Potion',type:'consumable',img:'icons/potion.webp',ownership:{default:2},system:{level:{value:1},traits:{rarity:'common'},category:'potion'}});
globalThis.fromUuid=async uuid=>uuid==='Compendium.pf2e.equipment-srd.Item.potion'?source:null;
let c=catalog.freshCurio();c.name='Moon Relic';c.description='PRIVATE SECRET';c.users=['alice'];c.gifts=[{...catalog.freshGift(),name:'Hidden Gift',description:'SECRET GIFT'}];
c=await catalog.saveCurio(c);
assert.equal(items.length,1);const originalId=items[0].id;
assert.equal(journals.length,3);
const summary=journals.find(d=>d.getFlag('brazier','catalog').kind==='curio-public');
assert(!JSON.stringify(summary).includes('SECRET'));
assert(!JSON.stringify(summary).includes('Hidden Gift'));
assert.deepEqual(Object.keys(summary.getFlag('brazier','catalog').summary).sort(),['icon','iconUrl','id','name']);
game.user=users[2];assert.equal(catalog.availableCurios()[0].locked,true);assert(!JSON.stringify(catalog.availableCurios()).includes('SECRET'));
await assert.rejects(catalog.saveCurio(c),/Storyteller/);await assert.rejects(catalog.syncCurio(c.id),/Storyteller/);await assert.rejects(catalog.saveBoons(catalog.boonCatalog()),/Storyteller/);
game.user=users[1];assert.equal(catalog.availableCurios()[0].description,'PRIVATE SECRET');assert.equal(catalog.availableCurios()[0].gifts[0].name,'Hidden Gift');assert.equal(catalog.curioWorldItem(c.id),null);
game.user=users[0];
const copy=new Doc({...clone(items[0]),system:{description:{value:'old'},quantity:7,rules:[{key:'FlatModifier',value:2}]}});actorItems.push(copy);
items[0].system.rules=[{key:'FlatModifier',value:1}];
const stale=clone(c);c.name='Updated Relic';c.users=['bob'];c=await catalog.saveCurio(c);
assert.equal(items.length,1);assert.equal(items[0].id,originalId);assert.equal(items[0].name,'Updated Relic');assert.equal(copy.name,'Updated Relic');assert.equal(copy.system.quantity,7);assert.equal(copy.system.rules[0].value,2);assert.equal(items[0].system.rules[0].value,1);
await assert.rejects(catalog.saveCurio(stale),/changed/);
game.user=users[1];assert.equal(catalog.availableCurios()[0].locked,true);assert(!readable(items[0],game.user));
game.user=users[2];assert.equal(catalog.availableCurios()[0].gifts.length,1);assert(readable(items[0],game.user));
game.user=users[0];
const itemUpdate=items[0].update.bind(items[0]);items[0].update=async d=>{if(d.name)throw new Error('write failed');return itemUpdate(d);};
c.description='New private detail';let failure;try{await catalog.saveCurio(c);}catch(e){failure=e;}
assert.match(failure.message,/saved, but synchronization failed/);c=failure.savedCurio;assert(c.updatedAt>stale.updatedAt);
items[0].update=itemUpdate;await catalog.syncCurio(c.id);assert(items[0].system.description.value.includes('New private detail'));
const failureDoc=journals.find(d=>d.getFlag('brazier','catalog').kind==='curio-detail');const update=failureDoc.update.bind(failureDoc);
failureDoc.update=async d=>{if(d.name)throw new Error('detail failed');return update(d);};
c.users=['alice'];try{await catalog.saveCurio(c);}catch(e){c=e.savedCurio;}
assert.equal(failureDoc.ownership.bob,undefined,'failed detail publish leaves old permissions revoked');assert.equal(failureDoc.ownership.default,0);
failureDoc.update=update;await catalog.syncCurio(c.id);
const b=await catalog.addConsumable('Compendium.pf2e.equipment-srd.Item.potion');assert.equal(b.consumables.length,1);assert.equal((await catalog.addConsumable(b.consumables[0].uuid)).consumables.length,1);
await assert.rejects(catalog.addConsumable('bad'),/consumable/);
b.consumableCount=3;await catalog.saveBoons(b);assert.equal(catalog.boonCatalog().consumableCount,3);await assert.rejects(catalog.saveBoons(b),/changed/);
for(const n of [-1,1.5,NaN,10000])await assert.rejects(catalog.saveBoons({...catalog.boonCatalog(),consumableCount:n}),/Invalid/);
game.user=users[2];assert.equal(catalog.boonCatalog().consumables[0].name,'Healing Potion');game.user=users[0];
for(const patch of [{name:''},{icon:'unknown'},{iconUrl:'javascript:alert(1)'},{users:['alice','alice']},{updatedAt:-1},{gifts:[{...catalog.freshGift(),sourceUuid:'javascript:x'}]}])assert.throws(()=>catalog.validateCurio({...catalog.freshCurio(),...patch}),/Invalid/);
const many=catalog.freshCurio();many.gifts=Array.from({length:120},()=>catalog.freshGift());assert.equal(catalog.validateCurio(many).gifts.length,120);
assert(catalog.curioDescription({...c,description:'<script>x</script>'}).includes('&lt;script&gt;'));
for(const bad of ['data:text/html,x','javascript:x','file:///etc/passwd','x\" onerror=x','x\nfoo'])assert.equal(catalog.assetPath(bad),'');
assert.equal(catalog.assetPath('https://example.com/a.webp'),'https://example.com/a.webp');
const indexData=[{_id:'p1',name:'Potion',type:'consumable',system:{category:'potion',level:{value:1},traits:{rarity:'common',value:['healing']}}},{_id:'w1',name:'Weapon',type:'weapon',system:{level:{value:2}}}];
game.packs=[{documentName:'Item',collection:'pf2e.equipment-srd',metadata:{label:'PF2E Equipment'},async getIndex(){return indexData;}},{documentName:'Actor',metadata:{}}];
catalog.clearItemIndex();const index=await catalog.itemIndex();assert.equal(index.length,2);assert.equal(catalog.filterItems(index,{type:'consumable',query:'pot',category:'potion',rarity:'common',trait:'healing',pack:'PF2E Equipment',min:1,max:1}).length,1);
for(const filters of [{query:'no match'},{category:'oil'},{rarity:'rare'},{pack:'other'},{trait:'fire'},{min:10},{max:0,type:'weapon'}])assert.equal(catalog.filterItems(index,filters).length,0);
assert.equal((await catalog.itemIndex()),index);
game.system.id='other';catalog.clearItemIndex();await assert.rejects(catalog.itemIndex(),/PF2E/);
console.log('Curio confidentiality, revocation, stable item identity, failure recovery, gift validation, boon count, deduplication and filtered catalog: PASSED');
