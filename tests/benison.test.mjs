import assert from 'node:assert/strict';
import {DEFAULT_BANDS,benisonAmount,validateBands,characterLevel} from '../scripts/benison-model.mjs';
import {prepareBenison,resetBenison,benisonItems,benisonDaily,registerBenisonDailies} from '../scripts/benison-dailies.mjs';
for(const [item,amount] of [[16,1],[14,1],[13,2],[11,2],[10,3],[0,3]])assert.equal(benisonAmount(15,item),amount);
const custom={highMinimum:0,middleMinimum:-3,highQuantity:4,middleQuantity:7,lowQuantity:9};
for(const [item,amount] of [[15,4],[14,7],[12,7],[11,9]])assert.equal(benisonAmount(15,item,custom),amount);
for(const patch of [{highMinimum:-4},{middleMinimum:2},{highQuantity:0},{lowQuantity:1.5},{middleMinimum:-31},{highQuantity:10000}])assert.throws(()=>validateBands({...DEFAULT_BANDS,...patch}),/Quantity bands/);
assert.equal(benisonAmount(null,1),null);assert.equal(benisonAmount(1,-1),null);
assert.equal(characterLevel({character:{type:'character',system:{details:{level:{value:2}}}}}),2);
const clone=structuredClone, sources=new Map(),docs=[];
const gm={id:'gm',isGM:true},player={id:'alice',isGM:false};
function itemDoc(source){return {...clone(source),id:source._id,getFlag(s,k){return this.flags?.[s]?.[k];}};}
function actorDoc(){return {uuid:'Actor.hero',type:'character',isOwner:true,level:15,system:{traits:{size:'med'}},items:[],flags:{},creates:0,
 getFlag(s,k){return this.flags[s]?.[k];},async setFlag(s,k,v){this.flags[s]??={};this.flags[s][k]=clone(v);},
 async createEmbeddedDocuments(type,values,opts){assert.equal(type,'Item');assert.equal(opts.keepId,true);this.creates++;for(const v of values){assert(!this.items.some(i=>i.id===v._id));this.items.push(itemDoc(v));}},
 async deleteEmbeddedDocuments(type,ids){this.items=this.items.filter(i=>!ids.includes(i.id));}};}
let actor=actorDoc();player.character=actor;
const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
let catalog={consumables:[],consumableCount:3,quantityBands:clone(DEFAULT_BANDS),runes:[],memories:[]};
let choices={consumables:[],runes:[],memories:[]};
const doc=value=>({getFlag(){return value;},testUserPermission(){return true;}});
globalThis.game={user:player,users,system:{id:'pf2e'},modules:new Map([['pf2e-dailies',{active:true}]]),journal:{filter:cb=>[doc({kind:'boons',boons:catalog}),doc({kind:'boon-choice',userId:'alice',choices})].filter(cb)},dailies:{api:{canPrepareDailies:()=>true}}};
globalThis.ui={notifications:{error(){},warn(){}}};
globalThis.fromUuid=async uuid=>sources.get(uuid);
for(const [id,level] of [['a',14],['b',11],['c',10]]){
 const uuid=`Compendium.test.items.Item.${id}`,source={name:`Potion ${id}`,type:'consumable',folder:'old',ownership:{default:3},system:{quantity:50,level:{value:level},traits:{value:['consumable','magical']},uses:{max:2,value:0}}};
 sources.set(uuid,{...source,traits:new Set(source.system.traits.value),level,toObject:()=>clone(source)});catalog.consumables.push({uuid,name:source.name,level});choices.consumables.push(uuid);
}
// Catalog storage identifies the public boon document by its established kind.
const purchased=itemDoc({_id:'purchased',name:'Purchased',system:{quantity:6},flags:{}});actor.items.push(purchased);
const [first,concurrent]=await Promise.all([prepareBenison(actor),prepareBenison(actor)]);
assert.deepEqual(first,concurrent);assert.equal(actor.creates,1);assert.deepEqual(benisonItems(actor).map(i=>i.system.quantity),[1,2,3]);
for(const item of benisonItems(actor)){assert.equal(item.system.temporary,true);assert.equal(item.system.uses.value,2);assert.equal(item.system.containerId,null);assert.equal(item.folder,undefined);assert(!item.system.traits.value.includes('infused'));}
assert.equal(sources.values().next().value.system.quantity,50,'compendium unchanged');
actor.items=actor.items.filter(i=>i.id==='purchased');assert((await prepareBenison(actor)).duplicate,'consumed gifts cannot be refilled in the same cycle');
let removed=[];await resetBenison({actor,removeItem:id=>removed.push(id)});
const old=itemDoc({_id:'old',system:{quantity:1},flags:{brazier:{benison:{schema:1,actorUuid:actor.uuid,cycle:'old'}}}});actor.items.push(old);
const unrelated=itemDoc({_id:'unrelated',system:{temporary:true},flags:{}});actor.items.push(unrelated);
catalog.quantityBands=custom;await prepareBenison(actor);
assert.deepEqual(benisonItems(actor).map(i=>i.system.quantity),[7,9,9]);assert(!actor.items.includes(old));assert(actor.items.includes(purchased));assert(actor.items.includes(unrelated));
removed=[];await resetBenison({actor,removeItem:id=>removed.push(id)});assert.equal(removed.length,3);
// Resolve failures validate the entire plan before any deletion.
const before=clone(actor.items.map(i=>i.id));sources.delete(choices.consumables[2]);
await assert.rejects(prepareBenison(actor),/unavailable/);assert.deepEqual(actor.items.map(i=>i.id),before);
choices.consumables.pop();catalog.consumableCount=1;await assert.rejects(prepareBenison(actor),/allowance/);catalog.consumableCount=3;
choices.consumables.push('missing');await assert.rejects(prepareBenison(actor),/no longer/);choices.consumables.pop();
users.push({id:'second',isGM:false,character:actor});await assert.rejects(prepareBenison(actor),/exactly one/);users.pop();
game.dailies.api.canPrepareDailies=()=>false;await assert.rejects(prepareBenison(actor),/already completed/);game.dailies.api.canPrepareDailies=()=>true;
actor.isOwner=false;await assert.rejects(prepareBenison(actor),/owned/);actor.isOwner=true;
game.user={id:'outsider',isGM:false};await assert.rejects(prepareBenison(actor),/assigned/);game.user=player;
// Partial creation and failed receipt writes retry without adding duplicate stacks.
actor.items=[purchased];let originalCreate=actor.createEmbeddedDocuments;
actor.createEmbeddedDocuments=async function(t,s,o){await originalCreate.call(this,t,s.slice(0,1),o);throw Error('network');};
await assert.rejects(prepareBenison(actor),/network/);assert.equal(benisonItems(actor).length,1);
actor.createEmbeddedDocuments=originalCreate;let setFlag=actor.setFlag;
actor.setFlag=async()=>{throw Error('receipt');};await assert.rejects(prepareBenison(actor),/receipt/);assert.equal(benisonItems(actor).length,2);
actor.setFlag=setFlag;const ids=benisonItems(actor).map(i=>i.id);await prepareBenison(actor);assert.deepEqual(benisonItems(actor).map(i=>i.id),ids);
// Native rest may already delete temporary items; reset remains safe.
actor.items=[purchased];await resetBenison({actor,removeItem(){throw Error('not expected');}});
const daily=benisonDaily();assert(daily.condition(actor));
const summaryRows=daily.rows(actor);
assert.equal(summaryRows.length,2,'one native row per consumable');
assert(summaryRows.every(row=>row.type==='notify'&&!row.message.includes('<br>')));
assert.equal(new Set(summaryRows.map(row=>row.slug)).size,2);
const originalName=catalog.consumables[0].name;catalog.consumables[0].name='Potion & \"Special\" <A>';
assert.equal(daily.rows(actor)[0].message,'Potion & \"Special\" <A> × 7','plain names are escaped once by the host template');
catalog.consumables[0].name=originalName;
const savedChoices=choices.consumables;choices.consumables=[];assert.match(daily.rows(actor)[0].message,/No consumables/);choices.consumables=savedChoices;
let message;
await daily.process({actor,messages:{addRaw:m=>message=m}});assert(message.includes('Potion'));
await daily.process({actor,messages:{addRaw:m=>message=m}});assert(message.includes('already'));
let definition;game.dailies.api.registerCustomDailies=entries=>definition=entries[0];assert(registerBenisonDailies());assert.equal(definition.key,daily.key);assert(!registerBenisonDailies());
// A formerly assigned character is cleaned without receiving anyone else's selections.
await resetBenison({actor,removeItem(){}});player.character=null;game.user=gm;await prepareBenison(actor);assert.equal(benisonItems(actor).length,0);assert(actor.items.includes(purchased));
console.log('Configurable quantity boundaries, preparation grants, native temporary flags, scoped cleanup, permissions, retry recovery and Dailies registration: PASSED');
