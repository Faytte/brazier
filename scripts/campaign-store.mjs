import {clone,uid} from './model.mjs';
import {freshCampaign,migrateCampaign,validateCampaign,projectCampaign,freshEntry,validateShroudChoices,appendHistory,visibleTo,integer} from './campaign-model.mjs';
const FLAG='campaign';let queue=Promise.resolve();
export const campaignDocs=()=>game.journal.filter(d=>d.getFlag('brazier',FLAG));
const value=d=>d.getFlag('brazier',FLAG);
const requireGM=()=>{if(!game.user.isGM)throw Error('Storyteller only.');};
export function campaignMaster(){requireGM();return campaignDocs().find(d=>value(d).kind==='master');}
export function campaignState(){
  const master=campaignMaster();if(master)return migrateCampaign(value(master).state);
  const state=freshCampaign(),legacy=game.journal.filter(d=>d.getFlag('brazier','catalog')?.kind==='boons')[0]?.getFlag('brazier','catalog').boons;
  state.memories=(legacy?.memories??[]).map(m=>({...freshEntry('memory'),id:m.uuid,name:m.name,description:m.description??''}));
  for(const doc of game.journal.filter(d=>d.getFlag('brazier','catalog')?.kind==='boon-choice')){const old=doc.getFlag('brazier','catalog');state.unlocks[old.userId]=(old.choices.memories??[]).filter(id=>state.memories.some(m=>m.id===id));}
  return state;
}
export function campaignView(user=game.user){
  if(!game.user.isGM)user=game.user;
  if(game.user.isGM)return projectCampaign(campaignState(),user);
  const doc=campaignDocs().find(d=>value(d).kind==='view'&&value(d).userId===user.id&&d.testUserPermission(user,'OBSERVER'));
  return doc?clone(value(doc).state):projectCampaign(freshCampaign(),user);
}
function serial(fn){const next=queue.catch(()=>{}).then(fn);queue=next.catch(()=>{});return next;}
export async function publishCampaign(state=campaignState()){
  requireGM();for(const user of game.users.filter(u=>!u.isGM)){
    const stateForUser=projectCampaign(state,user),doc=campaignDocs().find(d=>value(d).kind==='view'&&value(d).userId===user.id);
    const flags={brazier:{[FLAG]:{kind:'view',userId:user.id,state:stateForUser}}},ownership={default:0,[user.id]:2};
    if(doc)await doc.update({name:`Brazier • Campaign • ${user.name}`,ownership,[`flags.brazier.${FLAG}`]:flags.brazier[FLAG]},{diff:false,recursive:false});
    else await JournalEntry.create({name:`Brazier • Campaign • ${user.name}`,ownership,flags});
  }
}
async function persist(state){
  validateCampaign(state);
  // Revoke projections before any private-content edit; failed publication stays closed.
  for(const doc of campaignDocs().filter(d=>value(d).kind==='view'))await doc.update({ownership:{default:0}},{diff:false,recursive:false});
  state.updatedAt=Math.max(Date.now(),state.updatedAt+1);
  const doc=campaignMaster(),data={kind:'master',state:clone(state)};
  if(doc)await doc.update({[`flags.brazier.${FLAG}`]:data});else await JournalEntry.create({name:'Brazier • Campaign [Storyteller]',ownership:{default:0},flags:{brazier:{[FLAG]:data}}});
  try{await publishCampaign(state);}catch(error){throw Error(`Campaign saved, but player publication failed. Refresh player views; do not repeat inventory operations. ${error.message}`);}
  return clone(state);
}
export async function saveCampaign(input){requireGM();return serial(async()=>{const current=campaignState();if(input.updatedAt!==current.updatedAt)throw Error('Campaign changed; refresh before saving.');return persist(migrateCampaign(input));});}
export async function mutateCampaign(fn){requireGM();return serial(async()=>{const state=campaignState();await fn(state);return persist(state);});}
export async function awardMemory(id,userId,earned){return mutateCampaign(c=>{
  const entry=c.memories.find(e=>e.id===id),user=game.users.get(userId);if(!entry||!user||user.isGM)throw Error('Choose a Memory and player.');
  c.unlocks[userId]??=[];if(earned&&!entry.requires.every(dep=>c.unlocks[userId].includes(dep)))throw Error('Earn prerequisite Memories first.');
  if(!earned&&c.memories.some(m=>c.unlocks[userId].includes(m.id)&&m.requires.includes(id)))throw Error('A dependent Memory is still earned. Revoke it first.');
  c.unlocks[userId]=earned?[...new Set([...c.unlocks[userId],id])]:c.unlocks[userId].filter(v=>v!==id);
  appendHistory(c,earned?'memory-earned':'memory-revoked',userId,entry.name);c.history.at(-1).entryId=id;
});}
export function stableId(text){const hash=seed=>{let n=seed;for(const char of text)n=Math.imul(n^char.charCodeAt(0),16777619);return (n>>>0).toString(16).padStart(8,'0');};return hash(2166136261)+hash(3339675911);}
export function linkedCargo(c=campaignView(),user=game.user){
  const actor=c.caravan.actorUuid?(game.actors.get?.(c.caravan.actorUuid.split('.')[1])??[...game.actors].find(a=>a.uuid===c.caravan.actorUuid)):game.actors.party;
  return actor&&['party','loot'].includes(actor.type)&&actor.testUserPermission(user,'OBSERVER')?actor:null;
}
export async function campaignCommand(action,payload,userId=game.user.id,requestId=uid()){
  requireGM();return serial(async()=>{
    const c=campaignState();if(c.receipts.includes(requestId))return c;
    const user=game.users.get(userId);if(!user||user.isGM)throw Error('Choose a player using View as.');
    if(action==='prepare-shrouds'){
      validateShroudChoices(c,payload.ids,user);c.prepared[userId]=clone(payload.ids);appendHistory(c,action,userId,'Saved daily shroud loadout');
    }else if(action==='rune-targets'){
      const actor=user.character;if(actor?.type!=='character')throw Error('Assign a PF2E character first.');
      const {boonCatalog,boonChoices}=await import('./catalog.mjs');const b=boonCatalog(),choices=boonChoices(user).runes;
      for(const [uuid,id] of Object.entries(payload.targets??{})){
        if(!choices.includes(uuid)||!b.runes.some(r=>r.uuid===uuid))throw Error('Select and save that rune first.');
        const item=[...actor.items].find(i=>i.id===id);if(!item||!['weapon','armor','equipment','shield'].includes(item.type))throw Error('Invalid equipment target.');
      }
      c.runeTargets[userId]=clone(payload.targets??{});appendHistory(c,action,userId,'Saved rune equipment targets');
    }else if(action==='cargo-request'){
      const actor=linkedCargo(c,user),item=actor&&[...actor.items].find(i=>i.id===payload.itemId);integer(payload.quantity,1,9999,'requested quantity');
      if(!item||item.system.quantity<payload.quantity||user.character?.type!=='character'||user.character.uuid===actor.uuid)throw Error('Cargo or assigned recipient unavailable.');
      c.caravan.requests.push({id:requestId,userId,itemId:item.id,sourceUuid:actor.uuid,actorUuid:user.character.uuid,name:item.name,quantity:payload.quantity,status:'pending',createdAt:Date.now()});
      appendHistory(c,action,userId,`${item.name} × ${payload.quantity}`,'pending');
    }else if(action==='refund-request'){
      if(typeof payload.treeId!=='string'||typeof payload.nodeId!=='string')throw Error('Invalid talent request.');
      const {availableTrees}=await import('./store.mjs');const tree=availableTrees(user).find(t=>t.id===payload.treeId);if(!tree?.nodes.some(n=>n.id===payload.nodeId))throw Error('Talent unavailable.');
      c.caravan.requests.push({id:requestId,userId,treeId:payload.treeId,nodeId:payload.nodeId,name:'Talent refund',quantity:1,status:'pending',type:'refund',createdAt:Date.now()});appendHistory(c,action,userId,'Requested a talent refund','pending');
    }else throw Error('Unsupported campaign request.');
    c.receipts.push(requestId);return persist(c);
  });
}
export async function requestCampaign(action,payload,userId=game.user.id){
  if(game.user.isGM)return campaignCommand(action,payload,userId);
  return ChatMessage.create({content:'Brazier: campaign request',speaker:ChatMessage.getSpeaker(),whisper:game.users.filter(u=>u.isGM).map(u=>u.id),flags:{brazier:{campaignRequest:{action,payload}}}});
}
export async function receiveCampaignRequest(message){
  if(!game.user.isGM)return;const primary=game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];if(primary?.id!==game.user.id)return;
  const request=message.getFlag('brazier','campaignRequest');if(!request||message.getFlag('brazier','campaignProcessed'))return;
  if(!message.author||message.author.isGM)return;
  await campaignCommand(request.action,request.payload,message.author.id,message.id);await message.setFlag('brazier','campaignProcessed',true);
}
export async function resolveRequest(id,approve){return mutateCampaign(async c=>{
  if(c.history.length>=2000)throw Error('Activity history is full. Archive campaign data before inventory operations.');
  const r=c.caravan.requests.find(r=>r.id===id);if(!r||r.status!=='pending')throw Error('Request already resolved or unavailable.');
  if(!approve){r.status='declined';appendHistory(c,'request-declined',r.userId,r.name);return;}
  if(r.type==='refund'){const {refundTalent}=await import('./store.mjs');await refundTalent(r.treeId,r.nodeId,r.userId,r.id);r.status='approved';appendHistory(c,'refund-approved',r.userId,r.name);return;}
  const source=[...game.actors].find(a=>a.uuid===r.sourceUuid),target=[...game.actors].find(a=>a.uuid===r.actorUuid),item=source&&[...source.items].find(i=>i.id===r.itemId);
  if(!source||!target||!item||target.type!=='character')throw Error('A transfer participant is unavailable.');
  const targetId=stableId(`cargo:${r.id}`),existing=[...target.items].find(i=>i.id===targetId),receipts=item.getFlag('brazier','cargoReceipts')??[];
  if(existing&&existing.getFlag('brazier','cargoRequest')!==r.id)throw Error('Transfer item ID conflict.');
  if(!receipts.includes(r.id)){
    if(item.system.quantity<r.quantity)throw Error('Insufficient cargo. No stock was spent.');
    if(!existing){const data=item.toObject();data._id=targetId;delete data.folder;delete data.ownership;data.system.quantity=r.quantity;data.system.containerId=null;data.flags??={};data.flags.brazier={cargoRequest:r.id};await target.createEmbeddedDocuments('Item',[data],{keepId:true});}
    await source.updateEmbeddedDocuments('Item',[{_id:item.id,'system.quantity':item.system.quantity-r.quantity,'flags.brazier.cargoReceipts':[...receipts,r.id]}]);
  }
  r.status='approved';appendHistory(c,'cargo-transferred',r.userId,`${r.name} × ${r.quantity}`);
});}
