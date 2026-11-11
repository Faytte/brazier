import assert from 'node:assert/strict';
import {clone,freshTree,freshNode,purchase,rankCost,validateTree} from '../scripts/model.mjs';
import {freshCampaign,freshEntry,migrateCampaign,validateCampaign,projectCampaign,validateShroudChoices,shroudEligibility} from '../scripts/campaign-model.mjs';
import * as store from '../scripts/campaign-store.mjs';
import * as benefits from '../scripts/benefits.mjs';
const users=[{id:'gm',name:'Storyteller',isGM:true,active:true},{id:'alice',name:'Alice',isGM:false},{id:'bob',name:'Bob',isGM:false}];users.get=id=>users.find(u=>u.id===id);users.has=id=>users.some(u=>u.id===id);
const docs=[],actors=[],sources=new Map();let sequence=0;
const readable=(d,u,l='OBSERVER')=>u.isGM||(d.ownership[u.id]??d.ownership.default??0)>=(l==='OWNER'?3:2);
class Doc{
 constructor(data){Object.assign(this,clone(data));this.id??=this._id??`doc${++sequence}`;this.flags??={};this.ownership??={default:0};this.sheet={render(){}};}
 getFlag(scope,key){return this.flags[scope]?.[key];}testUserPermission(u,l){return readable(this,u,l);}
 async update(data){assert(game.user.isGM);for(const [path,value]of Object.entries(data)){const parts=path.split('.');let target=this;for(const key of parts.slice(0,-1))target=target[key]??={};target[parts.at(-1)]=clone(value);}return this;}
 async setFlag(scope,key,value){this.flags[scope]??={};this.flags[scope][key]=clone(value);}
 async delete(){docs.splice(docs.indexOf(this),1);}
 toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:clone(this.system),flags:clone(this.flags),ownership:clone(this.ownership)};}
}
function actor(id,type='character',quantity=0){const a={id,uuid:`Actor.${id}`,name:id,type,level:15,items:[],flags:{},ownership:{default:0,alice:3},isOwner:true,system:{traits:{size:'med'}},getFlag:Doc.prototype.getFlag,testUserPermission:Doc.prototype.testUserPermission,async setFlag(s,k,v){this.flags[s]??={};this.flags[s][k]=clone(v);},
 async createEmbeddedDocuments(t,values,o){for(const v of values){assert(o.keepId);if(this.items.some(i=>i.id===v._id))throw Error('duplicate');const d=new Doc(v);d.uuid=`${this.uuid}.Item.${d.id}`;this.items.push(d);}},
 async updateEmbeddedDocuments(t,values){for(const v of values)await this.items.find(i=>i.id===v._id).update(v);},
 async deleteEmbeddedDocuments(t,ids){this.items=this.items.filter(i=>!ids.includes(i.id));}};actors.push(a);return a;}
actors.get=id=>actors.find(a=>a.id===id);
const hero=actor('hero'),cargo=actor('cargo','party');users[1].character=hero;
globalThis.game={user:users[0],users,actors,journal:{filter:fn=>docs.filter(d=>readable(d,game.user)).filter(fn)},system:{id:'pf2e'},modules:new Map()};globalThis.JournalEntry={async create(data){const doc=new Doc(data);docs.push(doc);return doc;}};globalThis.fromUuid=async id=>sources.get(id)??actors.find(a=>a.uuid===id)??null;globalThis.ui={notifications:{info(){},warn(){},error(){}}};
const legacy=new Doc({flags:{brazier:{catalog:{kind:'boons',boons:{memories:[{uuid:'old-memory',name:'Legacy Memory',description:'Kept intact'}]}}}},ownership:{default:2}});docs.push(legacy);
docs.push(new Doc({flags:{brazier:{catalog:{kind:'boon-choice',userId:'alice',choices:{memories:['old-memory'],consumables:[],runes:[]}}}},ownership:{alice:2}}));
let c=store.campaignState();assert.equal(c.memories[0].name,'Legacy Memory');assert.deepEqual(c.unlocks.alice,['old-memory']);assert.equal(legacy.getFlag('brazier','catalog').boons.memories[0].uuid,'old-memory');
const memory={...freshEntry(),name:'The Vigil'},secret={...freshEntry(),name:'SECRET MEMORY',description:'PRIVATE TEXT',visibility:'gm'},shroud={...freshEntry('shroud'),name:'Emberward',requires:[memory.id],sourceUuid:'Item.ward',group:'vigil'};
c.memories.push(memory,secret);c.shrouds=[shroud];c.caravan.people=[{...freshEntry('person'),name:'SECRET CONTACT',visibility:'gm'}];c.caravan.actorUuid=cargo.uuid;await store.saveCampaign(c);
assert.throws(()=>validateCampaign({...migrateCampaign(c),schema:2}),/schema/);
const cyc=clone(c);cyc.memories[0].requires=[memory.id];cyc.memories[1].requires=['old-memory'];assert.throws(()=>validateCampaign(cyc),/Circular/);
await store.awardMemory(memory.id,'alice',true);await store.awardMemory(secret.id,'alice',true);
const view=store.campaignView(users[1]);assert(!JSON.stringify(view).includes('SECRET'));assert(!JSON.stringify(view).includes('PRIVATE'));assert(view.unlocks.alice.includes(memory.id));assert(!view.unlocks.alice.includes(secret.id));
await store.campaignCommand('prepare-shrouds',{ids:[shroud.id]},'alice','same-request');await store.campaignCommand('prepare-shrouds',{ids:[]},'alice','same-request');assert.deepEqual(store.campaignView(users[1]).prepared.alice,[shroud.id]);
await assert.rejects(store.campaignCommand('prepare-shrouds',{ids:[shroud.id,shroud.id]},'alice'),/Invalid/);
let state=store.campaignState();assert.equal(shroudEligibility(state,shroud,users[1]),'');assert.match(shroudEligibility(state,shroud,users[2]),/Assign/);
state.shroudCount=0;assert.throws(()=>validateShroudChoices(state,[shroud.id],users[1]),/capacity/);state.shroudCount=2;state.shrouds.push({...shroud,id:'other-shroud'});assert.throws(()=>validateShroudChoices(state,[shroud.id,'other-shroud'],users[1]),/one shroud/);
const stale=store.campaignState();await store.mutateCampaign(v=>{v.shroudCount=3;});await assert.rejects(store.saveCampaign(stale),/changed/);
game.user=users[1];assert(!JSON.stringify(store.campaignView(users[0])).includes('SECRET'),'players cannot impersonate GM by passing another user');await assert.rejects(store.saveCampaign(c),/Storyteller/);game.user=users[0];
const ward=new Doc({id:'ward',name:'A Ward',type:'effect',system:{rules:[],description:{value:'Effect'}},ownership:{default:2}});sources.set('Item.ward',ward);assert.equal((await benefits.benefitPreview('Item.ward')).status,'supported');
const purchaseItem=new Doc({id:'purchased',name:'Purchased item',type:'equipment',system:{quantity:4},ownership:{alice:3}});hero.items.push(purchaseItem);
await benefits.grantBenefits(hero,[{key:'memory',sourceUuid:'Item.ward'}],{scope:'test'});assert.equal(benefits.ownedBenefits(hero).length,1);await benefits.grantBenefits(hero,[{key:'memory',sourceUuid:'Item.ward'}],{scope:'test'});assert.equal(hero.items.length,2);
await benefits.grantBenefits(hero,[],{scope:'test'});assert.deepEqual(hero.items.map(i=>i.id),['purchased']);assert.equal(purchaseItem.system.quantity,4);
ward.system.rules=[{key:'ChoiceSet'}];assert.equal((await benefits.benefitPreview('Item.ward')).status,'manual');await assert.rejects(benefits.grantBenefits(hero,[{key:'choice',sourceUuid:'Item.ward'}],{scope:'test'}),/choice/);assert.equal(hero.items.length,1);ward.system.rules=[];
await benefits.grantBenefits(hero,[{key:'temporary',sourceUuid:'Item.ward'}],{scope:'daily',cycle:'a',lifetime:'daily'});await benefits.grantBenefits(hero,[{key:'temporary',sourceUuid:'Item.ward'}],{scope:'daily',cycle:'b',lifetime:'daily'});assert.equal(benefits.ownedBenefits(hero).length,1);await benefits.clearBenefitScope(hero,'daily');assert.equal(hero.items.length,1);
const weapon={id:'weapon',name:'Sword',type:'weapon',system:{runes:{potency:1,property:[]}}};assert.equal(benefits.runeEligibility({category:'weapon',slug:'flaming'},weapon),'');weapon.system.runes.property=['flaming'];assert.match(benefits.runeEligibility({category:'weapon',slug:'flaming'},weapon),/slot/);assert.match(benefits.runeEligibility({category:'armor'},weapon),/manual/);
const stock=new Doc({id:'stock',name:'Potion',type:'consumable',system:{quantity:6,traits:{value:['consumable']},level:{value:1}},ownership:{alice:2}});cargo.items.push(stock);
await Promise.all([store.campaignCommand('cargo-request',{itemId:'stock',quantity:4},'alice','cargo1'),store.campaignCommand('cargo-request',{itemId:'stock',quantity:4},'alice','cargo2')]);
await store.resolveRequest('cargo1',true);assert.equal(stock.system.quantity,2);assert.equal(hero.items.find(i=>i.getFlag('brazier','cargoRequest')==='cargo1').system.quantity,4);await assert.rejects(store.resolveRequest('cargo1',true),/resolved/);await assert.rejects(store.resolveRequest('cargo2',true),/Insufficient/);assert.equal(stock.system.quantity,2);await store.resolveRequest('cargo2',false);
let captured;globalThis.ChatMessage={getSpeaker(){return{};},async create(data){captured=data;}};game.user=users[1];await store.requestCampaign('prepare-shrouds',{ids:[]},'bob');assert(!captured.flags.brazier.campaignRequest.userId);game.user=users[0];
const message={id:'server-message',author:users[1],flags:{campaignRequest:{action:'prepare-shrouds',payload:{ids:[]},userId:'bob'}},getFlag(s,k){return this.flags[k];},async setFlag(s,k,v){this.flags[k]=v;}};await store.receiveCampaignRequest(message);assert.deepEqual(store.campaignView(users[1]).prepared.alice,[]);assert.equal(message.flags.campaignProcessed,true);
const t=freshTree();t.access='all';const n=freshNode();n.maxRank=2;n.rankCosts=[2,4];n.minimumLevel=5;t.nodes=[n];t.shared.points=10;validateTree(t);assert.throws(()=>purchase(t,n.id,'alice',false,4),/prerequisites/);purchase(t,n.id,'alice',false,5);assert.equal(t.shared.points,8);purchase(t,n.id,'alice',false,5);assert.equal(t.shared.points,4);assert.equal(rankCost(n,1),4);
console.log('Base 1 migration, private projections, earned Memory permissions, shroud constraints, source benefit ownership, rune boundaries, serialized cargo transfers, server-authored requests and rank pricing: PASSED');

for(const patch of [{minimumLevel:-1},{minimumLevel:31},{minimumLevel:1.5},{benefitUuid:'Actor.no'},{benefitUuid:5},{rankCosts:[1]},{rankCosts:[-1,2]},{rankCosts:'1,2'},{rankBenefits:['Item.a']},{rankBenefits:['Actor.a','Item.a']},{rankBenefits:[5,'Item.a']}]){
 const invalid=clone(t);Object.assign(invalid.nodes[0],patch);assert.throws(()=>validateTree(invalid));
}
for(const value of [null,[''],['r','r'],[5],new Array(10001).fill('r')])assert.throws(()=>validateTree({...clone(t),refundIds:value}));
const valid=clone(t);Object.assign(valid.nodes[0],{benefitUuid:'Item.ward',rankBenefits:['','Item.ward'],rankCosts:[],minimumLevel:0});valid.refundIds=['refund-1'];validateTree(valid);
for(const key of ['prepared','runeTargets']){const bad=store.campaignState();bad[key]=JSON.parse('{"__proto__":[]}');assert.throws(()=>validateCampaign(bad),/user ID/);}
await store.mutateCampaign(c=>{c.experimentalGrants=true;});
memory.sourceUuid='Item.ward';await store.mutateCampaign(c=>{const m=c.memories.find(e=>e.id===memory.id);m.sourceUuid='Item.ward';m.minimumLevel=16;});await benefits.syncMemories(users[1]);assert.equal(benefits.ownedBenefits(hero).length,0);hero.level=16;await benefits.syncMemories(users[1]);assert.equal(benefits.ownedBenefits(hero).length,1);
const {makeTree,saveTree,spendPoint,refundTalent,duplicateTree,availableTrees}=await import('../scripts/store.mjs');
const td=await makeTree('Refund regression');let talent=clone(td.getFlag('brazier','data').tree);talent.access='all';talent.shared.points=6;talent.nodes[0].cost=2;talent.nodes[0].benefitUuid='Item.ward';await saveTree(talent);const nid=talent.nodes[0].id;
await spendPoint(talent.id,nid,'alice','purchase-with-benefit');assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope.startsWith('talents:')).length,1);
await refundTalent(talent.id,nid,'alice','refund-1');assert.equal(availableTrees().find(t=>t.id===talent.id).shared.points,6);assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope.startsWith('talents:')).length,0);assert.equal((await refundTalent(talent.id,nid,'alice','refund-1')).duplicate,true);
await assert.rejects(refundTalent(talent.id,nid,'alice','bad-refund'),/No purchased/);await assert.rejects(refundTalent(talent.id,nid,'alice',null),/Invalid refund/);await assert.rejects(refundTalent(talent.id,nid,'missing','id'),/Player/);
const copyId=await duplicateTree(talent.id);const copy=availableTrees().find(t=>t.id===copyId);assert.equal(copy.shared.points,0);assert.deepEqual(copy.shared.ranks,{});assert.equal(copy.nodes[0].benefitUuid,'Item.ward');
console.log('Rank field validation, minimum-level synchronization, shared source grants, refund receipts and clean tree duplication: PASSED');
const secondHero=actor('second-hero');users[2].character=secondHero;
const curio={id:'growing-curio',bearerUuid:hero.uuid,gifts:[{id:'gift',name:'Gift',sourceUuid:'Item.ward',automation:'source',minimumLevel:20,revealed:true,milestone:'Vigil',unlocked:false},{id:'hidden-gift',name:'Hidden',sourceUuid:'Item.ward',automation:'source',revealed:false}]};
await benefits.syncCurioBenefits(curio);assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope==='curio:growing-curio').length,0);
curio.gifts[0].minimumLevel=1;await benefits.syncCurioBenefits(curio);assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope==='curio:growing-curio').length,0);
curio.gifts[0].unlocked=true;await benefits.syncCurioBenefits(curio);await benefits.syncCurioBenefits(curio);assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope==='curio:growing-curio').length,1);
curio.bearerUuid=secondHero.uuid;await benefits.syncCurioBenefits(curio);assert.equal(benefits.ownedBenefits(secondHero).length,1);assert.equal(benefits.ownedBenefits(hero).filter(i=>i.getFlag('brazier','benefit').scope==='curio:growing-curio').length,0);assert.equal(purchaseItem.system.quantity,4);
// A destination write followed by a source failure is recoverable without a second destination stack.
await store.campaignCommand('cargo-request',{itemId:'stock',quantity:1},'alice','partial-cargo');const originalUpdate=cargo.updateEmbeddedDocuments;let failStock=true;cargo.updateEmbeddedDocuments=async function(...args){if(failStock){failStock=false;throw Error('Injected source write failure');}return originalUpdate.apply(this,args);};
await assert.rejects(store.resolveRequest('partial-cargo',true),/Injected/);assert.equal(stock.system.quantity,2);assert.equal(hero.items.filter(i=>i.getFlag('brazier','cargoRequest')==='partial-cargo').length,1);await store.resolveRequest('partial-cargo',true);assert.equal(stock.system.quantity,1);assert.equal(hero.items.filter(i=>i.getFlag('brazier','cargoRequest')==='partial-cargo').length,1);cargo.updateEmbeddedDocuments=originalUpdate;
console.log('Curio level/milestone/reveal gates, bearer reconciliation and partial cargo transfer retry: PASSED');

// Default stash follows PF2E's active party, with explicit overrides and permission boundaries.
game.actors.party=cargo;const automatic=store.campaignState();automatic.caravan.actorUuid='';assert.equal(store.linkedCargo(automatic,users[1]),cargo);assert.equal(store.linkedCargo(automatic,users[2]),null);
const alternate=actor('alternate-stash','loot');automatic.caravan.actorUuid=alternate.uuid;assert.equal(store.linkedCargo(automatic,users[1]),alternate);automatic.caravan.actorUuid='Actor.deleted';assert.equal(store.linkedCargo(automatic,users[1]),null);automatic.caravan.actorUuid=hero.uuid;assert.equal(store.linkedCargo(automatic,users[1]),null);
console.log('Active PF2E Party stash default, explicit override, missing actor and observer permissions: PASSED');
