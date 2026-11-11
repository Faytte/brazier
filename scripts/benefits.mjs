import {clone} from './model.mjs';
import {campaignView,stableId} from './campaign-store.mjs';
import {validateShroudChoices,visibleTo} from './campaign-model.mjs';
import {boonCatalog,boonChoices} from './catalog.mjs';
const marker=item=>item.getFlag('brazier','benefit');
export const ownedBenefits=actor=>[...actor.items].filter(i=>marker(i)?.schema===1&&marker(i).actorUuid===actor.uuid);
const supportedRunes=new Set(['flaming','greater-flaming','frost','greater-frost','shock','greater-shock','corrosive','greater-corrosive','ghost-touch','returning','thundering','greater-thundering']);
function authorize(actor){if(game.system.id!=='pf2e'||actor?.type!=='character'||!actor.isOwner||!game.user.isGM&&game.user.character?.uuid!==actor.uuid)throw Error('Choose an owned PF2E character.');}
export async function benefitPreview(uuid){
  if(!uuid)return {status:'narrative',message:'Description only; no character mechanics.'};
  const source=await fromUuid(uuid);
  if(!source||!['feat','action','effect'].includes(source.type))return {status:'manual',message:'Use a feat, action or effect Item source for supported grants.'};
  if(!source.testUserPermission(game.user,'OBSERVER'))return {status:'manual',message:'Source is not accessible.'};
  if((source.system.rules??[]).some(r=>r.key==='ChoiceSet'&&r.selection===undefined))return {status:'manual',message:'This source requires a PF2E choice. Configure its selection in a dedicated source Item first.'};
  return {status:'supported',message:`Creates a linked ${source.type}: ${source.name}`,source};
}
export async function grantBenefits(actor,plans,{scope,cycle='permanent',lifetime='permanent'}={}){
  authorize(actor);if(!scope)throw Error('Missing benefit scope.');
  const sources=[];
  for(const plan of plans){
    let data;
    if(plan.data)data=clone(plan.data);else{
      const preview=await benefitPreview(plan.sourceUuid);if(preview.status!=='supported')throw Error(preview.message);
      data=clone(preview.source.toObject());delete data.folder;delete data.ownership;data._stats??={};data._stats.compendiumSource=plan.sourceUuid;
    }
    if(!['feat','action','effect'].includes(data.type))throw Error('Unsupported benefit Item type.');
    data._id=stableId(`${actor.uuid}|${scope}|${cycle}|${plan.key}|${plan.sourceUuid??'generated'}`);
    data.flags??={};data.flags.brazier??={};data.flags.brazier.benefit={schema:1,actorUuid:actor.uuid,scope,cycle,lifetime,key:plan.key,sourceUuid:plan.sourceUuid??'',label:plan.name??data.name};sources.push(data);
  }
  if(new Set(sources.map(s=>s._id)).size!==sources.length)throw Error('Duplicate benefit definition.');
  for(const source of sources){const old=[...actor.items].find(i=>i.id===source._id);if(old&&(!marker(old)||marker(old).scope!==scope||marker(old).key!==source.flags.brazier.benefit.key))throw Error('Benefit item ID conflict.');}
  const missing=sources.filter(s=>![...actor.items].some(i=>i.id===s._id));
  if(missing.length){try{await actor.createEmbeddedDocuments('Item',missing,{keepId:true});}catch(error){if(!sources.every(s=>[...actor.items].some(i=>i.id===s._id&&marker(i)?.scope===scope)))throw error;}}
  if(!sources.every(s=>[...actor.items].some(i=>i.id===s._id&&marker(i)?.scope===scope)))throw Error('Benefit grant incomplete. Retry to recover without duplicating items.');
  const ids=new Set(sources.map(s=>s._id)),obsolete=ownedBenefits(actor).filter(i=>marker(i).scope===scope&&!ids.has(i.id));
  if(obsolete.length)await actor.deleteEmbeddedDocuments('Item',obsolete.map(i=>i.id));
  return {created:missing.length,removed:obsolete.length,items:sources.map(s=>({name:s.name,id:s._id}))};
}
export async function clearBenefitScope(actor,scope){authorize(actor);const ids=ownedBenefits(actor).filter(i=>marker(i).scope===scope).map(i=>i.id);if(ids.length)await actor.deleteEmbeddedDocuments('Item',ids);return ids.length;}
export function runeEligibility(rune,target){
  if(!target)return 'Select equipment.';
  if(rune.category!=='weapon')return 'Armor and accessory runes require manual review; their temporary adapters are not enabled.';
  if(target.type!=='weapon')return 'Choose a weapon.';
  const system=target._source?.system??target.system;
  if(system.specific?.value)return 'Specific magic weapons require manual review.';
  if(!(system.runes?.potency>0))return 'Weapon needs a potency rune and a free property-rune slot.';
  const slots=system.runes.potency+(system.material?.type==='orichalcum'?1:0);
  if((system.runes.property??[]).length>=slots)return 'No free property-rune slot.';
  if(!supportedRunes.has(rune.slug??''))return 'This rune requires manual compatibility review.';
  const slug=(rune.slug??'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if((system.runes.property??[]).includes(slug))return 'This rune is already present.';
  return '';
}
export async function dailyBenefitPlans(actor,user){
  const c=campaignView(user),b=boonCatalog(),plans=[];const ids=c.prepared[user.id]??[];validateShroudChoices(c,ids,user);
  for(const id of ids){const s=c.shrouds.find(s=>s.id===id);if(s.sourceUuid)plans.push({key:`shroud:${id}`,name:s.name,sourceUuid:s.sourceUuid});}
  const used=new Map();
  for(const uuid of boonChoices(user).runes){
    const rune=b.runes.find(r=>r.uuid===uuid),target=[...actor.items].find(i=>i.id===c.runeTargets[user.id]?.[uuid]);
    if(!rune||!target)continue; // Unassigned/manual rune choices remain explicitly manual in the UI.
    const reason=runeEligibility(rune,target);if(reason)continue;
    const sourceSystem=target._source?.system??target.system,slots=sourceSystem.runes.potency+(sourceSystem.material?.type==='orichalcum'?1:0)-(sourceSystem.runes.property??[]).length;
    const count=(used.get(target.id)??0)+1;if(count>slots)throw Error(`Too many prepared runes for ${target.name}.`);used.set(target.id,count);
    plans.push({key:`rune:${uuid}:${target.id}`,name:rune.name,data:{name:`Benison: ${rune.name} — ${target.name}`,type:'effect',img:rune.img||'icons/svg/upgrade.svg',system:{description:{value:'Temporary Benison rune boon. The original weapon is unchanged.'},level:{value:rune.level},duration:{value:-1,unit:'unlimited',expiry:null,sustained:false},rules:[{key:'AdjustStrike',definition:[`item:id:${target.id}`],property:'property-runes',mode:'add',value:rune.slug}]}}});
  }
  return c.experimentalGrants?plans:[];
}
export async function syncMemories(user){
  if(!game.user.isGM)throw Error('Storyteller only.');const c=campaignView(),actor=user.character;if(!c.experimentalGrants)throw Error('Enable supported benefit grants in Campaign Settings after reviewing the integration note.');
  if(!actor)throw Error('Assign a character first.');const entries=c.memories.filter(m=>visibleTo(m,user)&&(c.unlocks[user.id]??[]).includes(m.id)&&m.sourceUuid&&(m.minimumLevel??0)<=(actor.level??0));
  return grantBenefits(actor,entries.map(m=>({key:m.id,name:m.name,sourceUuid:m.sourceUuid})),{scope:`memories:${user.id}`});
}
export async function syncCurioBenefits(curio){
  if(!game.user.isGM)throw Error('Storyteller only.');const actor=[...game.actors].find(a=>a.uuid===curio.bearerUuid);if(!actor)throw Error('Choose a bearer first.');
  if(!campaignView().experimentalGrants)throw Error('Supported benefit grants are disabled in Campaign Settings.');
  const gifts=curio.gifts.filter(g=>g.revealed!==false&&g.automation==='source'&&(g.minimumLevel??0)<=(actor.level??0)&&(!g.milestone||g.unlocked));
  const result=await grantBenefits(actor,gifts.map(g=>({key:g.id,name:g.name,sourceUuid:g.sourceUuid})),{scope:`curio:${curio.id}`});
  for(const other of game.actors)if(other.uuid!==actor.uuid&&other.type==='character'&&other.isOwner)await clearBenefitScope(other,`curio:${curio.id}`);
  return result;
}

export async function syncTalentBenefits(tree,user){
  if(!game.user.isGM)throw Error('Storyteller only.');if(!campaignView().experimentalGrants)throw Error('Supported grants are disabled.');
  const {progressFor,rankOf}=await import('./model.mjs');const progress=progressFor(tree,user.id),plans=[];
  for(const node of tree.nodes){const rank=rankOf(progress,node.id);if(!rank)continue;const sourceUuid=node.rankBenefits?.[rank-1]||node.benefitUuid;if(sourceUuid)plans.push({key:node.id,name:node.name,sourceUuid});}
  return grantBenefits(user.character,plans,{scope:`talents:${tree.id}:${user.id}`});
}

/** Shared purchases reconcile every accessible assigned character, personal purchases only their owner. */
export async function syncTreeBenefits(tree,user){
  const {isAccessible}=await import('./model.mjs');
  const recipients=tree.progression==='shared'?game.users.filter(u=>!u.isGM&&u.character?.type==='character'&&isAccessible(tree,u.id,u.isGM)):[user];
  for(const recipient of recipients){if(recipient?.character)await syncTalentBenefits(tree,recipient);}
}
