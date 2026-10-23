import {MODULE_ID,uid,clone} from "./model.mjs";
import {boonCatalog,boonChoices,escapeHTML} from "./catalog.mjs";
import {assignedCharacter,characterLevel,benisonAmount,isBenisonConsumable} from "./benison-model.mjs";

const DAILY_KEY="brazier-benison-consumables";
const operations=new Map();
const stateOf=actor=>actor.getFlag(MODULE_ID,"benisonState")??{cycle:"initial",prepared:false};
export const assignedPlayers=actor=>game.users.filter(u=>!u.isGM&&assignedCharacter(u)?.uuid===actor.uuid);
const marker=item=>item.getFlag(MODULE_ID,"benison");
export const benisonItems=actor=>[...actor.items].filter(item=>marker(item)?.schema===1&&marker(item).actorUuid===actor.uuid);
function authorize(actor){
  if(game.system?.id!=="pf2e"||actor.type!=="character"||!actor.isOwner)throw new Error("Benison preparation requires an owned PF2E character.");
  if(!game.user.isGM&&assignedCharacter(game.user)?.uuid!==actor.uuid)throw new Error("Prepare Benison consumables for your assigned character.");
}
function itemId(actor,cycle,source){
  // Stable 16-character IDs let Foundry reject concurrent duplicate creation.
  const text=`${actor.uuid}|${cycle}|${source}`;
  const hash=seed=>{let value=seed;for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);return (value>>>0).toString(16).padStart(8,"0");};
  return hash(2166136261)+hash(3339675911);
}
export async function prepareBenison(actor){
  authorize(actor);
  if(operations.has(actor.uuid))return operations.get(actor.uuid);
  const pending=prepareCore(actor);operations.set(actor.uuid,pending);
  try{return await pending;}finally{if(operations.get(actor.uuid)===pending)operations.delete(actor.uuid);}
}
async function prepareCore(actor){
  const state=clone(stateOf(actor));
  if(state.prepared)return {duplicate:true,items:[],removed:0};
  if(game.dailies?.api?.canPrepareDailies?.(actor)===false)throw new Error("This character has already completed daily preparation. Rest before preparing again.");
  const users=assignedPlayers(actor);
  if(!users.length){
    const old=benisonItems(actor).map(item=>item.id);if(old.length)await actor.deleteEmbeddedDocuments("Item",old);
    await actor.setFlag(MODULE_ID,"benisonState",{cycle:state.cycle,prepared:true});
    return {duplicate:false,items:[],removed:old.length};
  }
  if(users.length!==1)throw new Error("Assign exactly one player account to this character for Benison preparation.");
  const user=users[0],level=characterLevel(user),b=boonCatalog(),selected=boonChoices(user).consumables;
  if(level===null)throw new Error("The assigned character needs a valid level.");
  if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.length>b.consumableCount)throw new Error("Saved Benison selections exceed the current allowance. Save your choices again.");
  const sources=[];
  // Resolve and validate the entire plan before touching any existing inventory.
  for(const uuid of selected){
    if(!b.consumables.some(item=>item.uuid===uuid))throw new Error("A saved Benison choice is no longer in Current Options. Save your choices again.");
    const item=await fromUuid(uuid);
    if(!item||!isBenisonConsumable(item))throw new Error(`Benison source unavailable or missing the consumable trait: ${uuid}`);
    const quantity=benisonAmount(level,item.level??item.system.level.value,b.quantityBands);
    if(quantity===null)throw new Error(`Invalid level on Benison source: ${item.name}`);
    const source=clone(item.toObject());source._id=itemId(actor,state.cycle,uuid);
    delete source.folder;delete source.ownership;
    source.system.quantity=quantity;source.system.temporary=true;source.system.containerId=null;
    const size=actor.system.traits?.size;source.system.size=typeof size==="string"?size:size?.value??"med";
    source.system.equipped={carryType:"worn",handsHeld:0};
    if(source.system.uses?.max)source.system.uses.value=source.system.uses.max;
    source._stats??={};
    if(uuid.startsWith("Compendium."))source._stats.compendiumSource=uuid;
    else source._stats.duplicateSource=uuid;
    source.flags??={};source.flags[MODULE_ID]??={};
    source.flags[MODULE_ID].benison={schema:1,userId:user.id,actorUuid:actor.uuid,cycle:state.cycle,sourceUuid:uuid,quantity};
    sources.push(source);
  }
  if(stateOf(actor).cycle!==state.cycle)throw new Error("The character rested during preparation. Reopen Dailies and try again.");
  const matches=(item,source)=>marker(item)?.actorUuid===actor.uuid&&marker(item).cycle===state.cycle&&marker(item).sourceUuid===source.flags[MODULE_ID].benison.sourceUuid;
  const find=id=>[...actor.items].find(item=>item.id===id);
  for(const source of sources){const existing=find(source._id);if(existing&&!matches(existing,source))throw new Error("Benison item ID collision; no existing item was overwritten.");}
  const missing=sources.filter(source=>!find(source._id));
  if(missing.length){
    try{await actor.createEmbeddedDocuments("Item",missing,{keepId:true});}
    catch(error){if(!sources.every(source=>{const item=find(source._id);return item&&matches(item,source);}))throw error;}
  }
  if(stateOf(actor).cycle!==state.cycle){
    const obsolete=sources.map(source=>find(source._id)).filter(item=>item&&marker(item)?.cycle===state.cycle).map(item=>item.id);
    if(obsolete.length)await actor.deleteEmbeddedDocuments("Item",obsolete);
    throw new Error("The character rested during preparation. Reopen Dailies and try again.");
  }
  if(!sources.every(source=>{const item=find(source._id);return item&&matches(item,source);}))throw new Error("Benison item creation was incomplete. Retry preparation; existing marked stacks will not be duplicated.");
  const ids=new Set(sources.map(source=>source._id));
  const old=benisonItems(actor).filter(item=>!ids.has(item.id)).map(item=>item.id);
  if(old.length)await actor.deleteEmbeddedDocuments("Item",old);
  await actor.setFlag(MODULE_ID,"benisonState",{cycle:state.cycle,prepared:true});
  return {duplicate:false,items:sources.map(source=>({name:source.name,quantity:source.system.quantity})),removed:old.length};
}
export async function resetBenison({actor,removeItem}){
  for(const item of benisonItems(actor))removeItem(item.id);
  await actor.setFlag(MODULE_ID,"benisonState",{cycle:uid(),prepared:false});
}
export function benisonDaily(){
  return {
    key:DAILY_KEY,label:"Benison Consumables",
    condition:actor=>actor.type==="character"&&actor.isOwner&&(game.user.isGM||assignedCharacter(game.user)?.uuid===actor.uuid)&&(boonCatalog().consumables.length>0||Boolean(actor.getFlag(MODULE_ID,"benisonState"))||benisonItems(actor).length>0),
    rows:actor=>{
      const users=assignedPlayers(actor),b=boonCatalog();
      const text=users.length!==1?"Assign exactly one player account to this character before preparing Benison consumables.":(()=>{
        const user=users[0],selected=boonChoices(user).consumables,level=characterLevel(user);
        return selected.length?selected.map(uuid=>{const item=b.consumables.find(i=>i.uuid===uuid);return item?`${escapeHTML(item.name)} × ${benisonAmount(level,item.level,b.quantityBands)??"?"}`:"A saved choice is no longer available; save choices again in Brazier.";}).join("<br>"):"No consumables selected. Save your selections in Brazier before daily preparation.";
      })();
      return [{type:"notify",slug:"consumables",label:"Benison",save:false,message:text}];
    },
    process:async({actor,messages})=>{
      try{
        const result=await prepareBenison(actor);
        messages.addRaw(result.duplicate?"Benison consumables were already prepared this cycle.":`Benison consumables: ${result.items.map(i=>`${escapeHTML(i.name)} × ${i.quantity}`).join(", ")||"none selected"}.`);
      }catch(error){ui.notifications.error(`Brazier Benison: ${error.message}`);throw error;}
    },
    rest:resetBenison
  };
}
let registered=false;
export function registerBenisonDailies(){
  if(registered||game.system?.id!=="pf2e"||!game.modules.get("pf2e-dailies")?.active)return false;
  const api=game.dailies?.api;
  if(typeof api?.registerCustomDailies!=="function"){
    if(game.user.isGM)ui.notifications.warn("Brazier: PF2e Dailies registration API is unavailable; Benison grants are disabled.");
    return false;
  }
  api.registerCustomDailies([benisonDaily()]);registered=true;return true;
}
