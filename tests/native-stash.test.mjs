import assert from 'node:assert/strict';
import {freshCampaign} from '../scripts/campaign-model.mjs';
import {stashActor,openNativeStash,stashPerspectiveBlocked} from '../scripts/native-stash.mjs';
const gm={id:'gm',isGM:true},player={id:'alice',isGM:false};const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
const docs=[],actors=[];let calls=[];
function actor(id,type='party',access=1){return {id,uuid:`Actor.${id}`,type,access,items:[{id:'original',quantity:8}],
 testUserPermission(user,level){return user.isGM||this.access>=(typeof level==='number'?level:{LIMITED:1,OBSERVER:2,OWNER:3}[level]);},
 sheet:{options:{viewPermission:1},render(...args){calls.push(args);return this;}},
 update(){throw Error('Native handoff must never write actor data.');},createEmbeddedDocuments(){throw Error('No custom inventory writes.');}};}
const party=actor('party'),loot=actor('loot','loot'),creature=actor('hero','character');actors.push(party,loot,creature);actors.party=party;
globalThis.game={system:{id:'pf2e'},user:gm,users,actors,journal:{filter:fn=>docs.filter(fn)}};
const app={viewAsUserId:null};assert.equal(stashActor(),party);assert.equal(stashActor({caravan:{actorUuid:loot.uuid}}),loot);assert.equal(stashActor({caravan:{actorUuid:creature.uuid}}),null);assert.equal(stashActor({caravan:{actorUuid:'Actor.deleted'}}),null);
const original=JSON.stringify(party.items);await openNativeStash(app);assert.deepEqual(calls.pop(),[true,{tab:'inventory',focus:true}]);assert.equal(JSON.stringify(party.items),original);
// Limited users can open the native sheet; transfer rights remain entirely in PF2E.
game.user=player;await openNativeStash(app);assert.equal(calls.length,1);calls=[];party.access=0;await assert.rejects(openNativeStash(app),/not shared/);assert.equal(calls.length,0);party.access=1;
party.sheet.options.viewPermission=2;await assert.rejects(openNativeStash(app),/not shared/);party.sheet.options.viewPermission=1;
game.user=gm;app.viewAsUserId=player.id;assert(stashPerspectiveBlocked(app));await assert.rejects(openNativeStash(app),/signed-in/);assert.equal(calls.length,0);app.viewAsUserId=null;
// Explicit overrides are preserved and never silently redirected to another inventory.
const state=freshCampaign();state.caravan.actorUuid=loot.uuid;docs.push({getFlag(){return {kind:'master',state};}});await openNativeStash(app);assert.deepEqual(calls.pop(),[true,{tab:'inventory',focus:true}]);state.caravan.actorUuid='Actor.deleted';await assert.rejects(openNativeStash(app),/No PF2E/);docs.length=0;
const sheet=party.sheet;party.sheet=null;await assert.rejects(openNativeStash(app),/no available/);party.sheet=sheet;
const V2=class {async render(options){calls.push(options);return this;}};globalThis.foundry={applications:{api:{ApplicationV2:V2}}};party.sheet=new V2();await openNativeStash(app);assert.deepEqual(calls.pop(),{force:true,tab:'inventory'});party.sheet=sheet;
party.sheet.render=()=>{throw Error('Native rendering failed');};await assert.rejects(openNativeStash(app),/Native rendering failed/);assert.equal(JSON.stringify(party.items),original);
game.system.id='dnd5e';await assert.rejects(openNativeStash(app),/PF2E game system/);game.system.id='pf2e';actors.party=null;await assert.rejects(openNativeStash(app),/No PF2E/);
console.log('Native PF2E stash delegation, LIMITED/configured permission, View As isolation, override, render signatures and no inventory mutations: PASSED');
