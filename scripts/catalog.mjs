import {MODULE_ID, ICONS, uid, clone} from "./model.mjs";
import {PROPERTY_RUNE_IDS,FUNDAMENTAL_RUNE_IDS} from "./rune-reference.mjs";

const flag="catalog";
const data=doc=>doc.getFlag(MODULE_ID,flag);
const gm=()=>{if(!game.user.isGM)throw new Error("Only the Storyteller can change this catalog.");};
const docs=()=>game.journal.filter(doc=>data(doc));
const readable=doc=>doc.testUserPermission(game.user,"OBSERVER");
const privateOwner={default:0};
// Ownership must replace the mapping, rather than recursively retain old users.
const setOwnership=(doc,ownership)=>doc.update({ownership},{diff:false,recursive:false});
const queues=new Map();
function serial(key,fn){const next=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,next);void next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});return next;}
export const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
export function assetPath(value){return typeof value==="string"&&value.length<500&&!/[<>"'`\\\x00-\x1f\x7f]/.test(value)&&!/^\s*(?:[a-z]+:)/i.test(value.replace(/^https?:/i,""))?value:"";}
export function freshCurio(){return {schema:1,id:uid(),name:"New Curio",icon:"gem",iconUrl:"",description:"",users:[],gifts:[],updatedAt:0};}
export function freshGift(){return {id:uid(),name:"New Relic Gift",aspect:"",tier:"minor",description:"",sourceUuid:""};}
export function validateCurio(c){
  const str=(v,max,blank=true)=>typeof v==="string"&&v.length<=max&&(blank||v.trim().length>0);
  if(!c||c.schema!==1||!str(c.id,128,false)||!str(c.name,120,false)||!str(c.description,20000)||!Object.hasOwn(ICONS,c.icon)||!str(c.iconUrl,499)||assetPath(c.iconUrl)!==c.iconUrl||!Number.isSafeInteger(c.updatedAt)||c.updatedAt<0)throw new Error("Invalid Curio fields or image path.");
  if(!Array.isArray(c.users)||c.users.some(id=>!str(id,128,false))||new Set(c.users).size!==c.users.length)throw new Error("Invalid Curio permissions.");
  if(!Array.isArray(c.gifts)||new Set(c.gifts.map(g=>g.id)).size!==c.gifts.length)throw new Error("Invalid relic gift list.");
  for(const g of c.gifts)if(!str(g.id,128,false)||!str(g.name,120,false)||!str(g.aspect,120)||!["minor","major","grand"].includes(g.tier)||!str(g.description,20000)||!str(g.sourceUuid,512)||g.sourceUuid&&!/^(?:Compendium\.[\w.-]+|Item\.[\w-]+)$/.test(g.sourceUuid))throw new Error("Invalid relic gift fields.");
  if(JSON.stringify(c).length>1_500_000)throw new Error("Curio exceeds the document size limit.");
  return c;
}
export function availableCurios(user=game.user){
  if(!game.user.isGM)user=game.user;
  if(game.user.isGM&&user.isGM)return docs().filter(d=>data(d).kind==="curio-master").map(d=>clone(data(d).curio));
  return docs().filter(d=>data(d).kind==="curio-public"&&d.testUserPermission(user,"OBSERVER")).map(d=>{
    const summary=clone(data(d).summary);
    const detail=docs().find(p=>data(p).kind==="curio-detail"&&data(p).curioId===summary.id&&p.testUserPermission(user,"OBSERVER"));
    return detail?{...summary,...clone(data(detail).detail)}:{...summary,locked:true};
  });
}
function master(id){return docs().find(d=>data(d).kind==="curio-master"&&data(d).curio.id===id);}
function itemMatches(item,id){return item.getFlag(MODULE_ID,"curioId")===id;}
function curioItems(id){return [...(game.items??[])].filter(i=>itemMatches(i,id));}
export function curioDescription(c){
  const p=t=>escapeHTML(t).replace(/\n/g,"<br>");
  return `<section class="brazier-curio-description"><p>${p(c.description)}</p>${c.gifts.map(g=>`<h3>${p(g.name)}</h3><p>${p(g.tier)} gift${g.aspect?` · ${p(g.aspect)}`:""}</p><p>${p(g.description)}</p>${g.sourceUuid?`<p>@UUID[${g.sourceUuid}]{Gift source}</p>`:""}`).join("")}</section>`;
}
export async function saveCurio(input){
  gm();const c=clone(input);validateCurio(c);
  return serial(c.id,async()=>{
    const doc=master(c.id),current=doc&&data(doc).curio;
    if(current&&current.updatedAt!==c.updatedAt)throw new Error("Curio changed; reopen it before saving.");
    if(!current&&c.updatedAt!==0)throw new Error("Curio master no longer exists.");
    // Revoke stale access before changing secrets; a later failure leaves details closed.
    await revokeCurio(c.id);
    c.users=c.users.filter(id=>game.users.get(id)&&!game.users.get(id).isGM);
    c.updatedAt=Math.max(Date.now(),(current?.updatedAt??0)+1);
    const body={kind:"curio-master",curio:c};
    if(doc)await doc.update({name:`Brazier Curio • ${c.name} [Storyteller]`,[`flags.${MODULE_ID}.${flag}`]:body});
    else await JournalEntry.create({name:`Brazier Curio • ${c.name} [Storyteller]`,ownership:privateOwner,flags:{[MODULE_ID]:{[flag]:body}}});
    try{await publishCurio(c);}catch(cause){const error=new Error(`Curio saved, but synchronization failed: ${cause.message}. Use Retry Item Sync.`);error.savedCurio=c;throw error;}
    return c;
  });
}
async function upsertJournal(kind,id,name,ownership,payload){
  const doc=docs().find(d=>data(d).kind===kind&&data(d).curioId===id);
  const value={kind,curioId:id,...payload};
  if(doc){await doc.update({name,[`flags.${MODULE_ID}.${flag}`]:value});return setOwnership(doc,ownership);}
  return JournalEntry.create({name,ownership,flags:{[MODULE_ID]:{[flag]:value}}});
}
async function revokeCurio(id){
  for(const p of docs().filter(d=>data(d).kind==="curio-detail"&&data(d).curioId===id))await setOwnership(p,privateOwner);
  for(const item of curioItems(id))await setOwnership(item,privateOwner);
}
async function publishCurio(c){
  const ownership={default:0,...Object.fromEntries(c.users.map(id=>[id,2]))};
  await upsertJournal("curio-detail",c.id,`Brazier Curio • ${c.name} [Details]`,ownership,{detail:{description:c.description,gifts:clone(c.gifts)}});
  // The publicly readable document contains only these explicitly selected fields.
  await upsertJournal("curio-public",c.id,`Brazier Curio • ${c.name}`,{default:2},{summary:{id:c.id,name:c.name,icon:c.icon,iconUrl:c.iconUrl}});
  if(game.system?.id!=="pf2e")return;
  const source={name:c.name,type:"equipment",img:c.iconUrl||`modules/brazier/assets/icons/${c.icon}.svg`,ownership,
    system:{description:{value:curioDescription(c)},traits:{value:["magical","relic"],rarity:"unique"},quantity:1,level:{value:0},usage:{value:"held-in-one-hand"}},
    flags:{[MODULE_ID]:{curioId:c.id,curioRevision:c.updatedAt}}};
  const existing=curioItems(c.id);
  if(existing.length>1)throw new Error("Multiple world items share this Curio ID. Remove the extra template before synchronizing.");
  if(existing[0]){await existing[0].update({name:source.name,img:source.img,"system.description.value":source.system.description.value,[`flags.${MODULE_ID}.curioRevision`]:c.updatedAt});await setOwnership(existing[0],ownership);}
  else await Item.create(source);
  // Existing distributed copies keep their own inventory state and authored mechanics.
  // Only copies carrying this exact provenance marker receive catalog text/art updates.
  for(const actor of game.actors??[])for(const item of actor.items??[])if(itemMatches(item,c.id))await item.update({name:source.name,img:source.img,"system.description.value":source.system.description.value,[`flags.${MODULE_ID}.curioRevision`]:c.updatedAt});
}
export async function syncCurio(id){gm();return serial(id,async()=>{const doc=master(id);if(!doc)throw new Error("Curio not found.");await revokeCurio(id);await publishCurio(data(doc).curio);});}
export async function refreshCatalog(){gm();for(const doc of docs().filter(d=>data(d).kind==="curio-master"))await syncCurio(data(doc).curio.id);}
export function curioWorldItem(id){return game.user.isGM?curioItems(id)[0]??null:null;}

export function boonCatalog(){
  const doc=docs().find(d=>data(d).kind==="boons"&&readable(d));
  return {runeCount:1,...clone(doc?data(doc).boons:{schema:1,updatedAt:0,consumableCount:1,consumables:[],runes:[],memories:[]})};
}
export async function saveBoons(input){
  gm();const b=clone(input);
  return serial("boons",async()=>{
    if(b.schema!==1||!Number.isSafeInteger(b.consumableCount)||b.consumableCount<0||b.consumableCount>9999||!["consumables","runes","memories"].every(k=>Array.isArray(b[k])&&b[k].length<=5000))throw new Error("Invalid boon catalog or consumable count.");
    if(!Number.isSafeInteger(b.runeCount??1)||b.runeCount<0||b.runeCount>9999)throw new Error("Invalid rune choice count.");
    for(const key of ["consumables","runes","memories"])for(const entry of b[key])if(typeof entry.uuid!=="string"||typeof entry.name!=="string"||entry.name.length>200)throw new Error("Invalid boon entry.");
    const doc=docs().find(d=>data(d).kind==="boons");
    if((doc?data(doc).boons.updatedAt:0)!==b.updatedAt)throw new Error("Boons changed; refresh before saving.");
    b.updatedAt=Math.max(Date.now(),b.updatedAt+1);
    const value={kind:"boons",boons:b};
    if(doc)await doc.update({[`flags.${MODULE_ID}.${flag}`]:value});
    else await JournalEntry.create({name:"Brazier • Benison Boons",ownership:{default:2},flags:{[MODULE_ID]:{[flag]:value}}});
    return b;
  });
}
export async function addConsumable(uuid){
  gm();const item=await fromUuid(uuid);
  if(!item?.isOfType?.("consumable"))throw new Error("Choose a PF2E consumable item.");
  const b=boonCatalog();if(b.consumables.some(i=>i.uuid===uuid))return b;
  b.consumables.push({uuid,name:item.name,img:assetPath(item.img),level:item.system.level.value,category:item.system.category,rarity:item.system.traits.rarity});
  return saveBoons(b);
}
export function runeKind(item){
  if(item.type!=="equipment")return "";
  const id=item.uuid?.split(".").at(-1),official=item.uuid?.startsWith("Compendium.pf2e.equipment-srd.");
  if(official&&FUNDAMENTAL_RUNE_IDS.includes(id))return "";
  if(official&&PROPERTY_RUNE_IDS[id])return PROPERTY_RUNE_IDS[id];
  const usage=item.usage??item.system?.usage?.value??"",name=(item.slug??item.system?.slug??item.name??"").toLowerCase();
  if(/potency|striking|resilien|reinforcing/.test(name))return "";
  if(!usage.startsWith("etched-"))return "";
  return usage.includes("armor")?"armor":usage.includes("weapon")||usage.includes("clan-dagger")?"weapon":"";
}
export async function addRune(uuid){
  gm();const item=await fromUuid(uuid),kind=item&&runeKind(item);
  if(!kind)throw new Error("Choose a property or accessory rune; fundamental runes are excluded.");
  const b=boonCatalog();if(b.runes.some(i=>i.uuid===uuid))return b;
  b.runes.push({uuid,name:item.name,img:assetPath(item.img),level:item.system.level.value,category:kind,rarity:item.system.traits.rarity});return saveBoons(b);
}
export function boonChoices(user=game.user){
  if(!game.user.isGM)user=game.user;
  const doc=docs().find(d=>data(d).kind==="boon-choice"&&data(d).userId===user.id&&d.testUserPermission(user,"OBSERVER"));
  return clone(doc?data(doc).choices:{consumables:[],runes:[],memories:[]});
}
export async function setBoonChoices(section,uuids,userId,requestId=null){
  gm();return serial(`choice:${userId}`,async()=>{
    const doc=docs().find(d=>data(d).kind==="boon-choice"&&data(d).userId===userId);
    const requestIds=clone(doc?data(doc).requestIds??[]:[]);
    if(requestId&&requestIds.includes(requestId))return boonChoices(game.users.get(userId));
    const user=game.users.get(userId),b=boonCatalog();
    if(!user||user.isGM||!["consumables","runes","memories"].includes(section)||!Array.isArray(uuids)||new Set(uuids).size!==uuids.length||uuids.some(id=>!b[section].some(i=>i.uuid===id)))throw new Error("Invalid player choices.");
    const limit=section==="consumables"?b.consumableCount:section==="runes"?b.runeCount:b.memories.length;
    if(uuids.length>limit)throw new Error("Too many choices for the current allowance.");
    const choices=boonChoices(user);choices[section]=clone(uuids);
    if(requestId){if(requestIds.length>=10000)throw new Error("Selection request history limit reached.");requestIds.push(requestId);}
    const value={kind:"boon-choice",userId,choices,requestIds};
    if(doc)await doc.update({[`flags.${MODULE_ID}.${flag}`]:value});
    else await JournalEntry.create({name:`Brazier • ${user.name??userId} Choices`,ownership:{default:0,[userId]:2},flags:{[MODULE_ID]:{[flag]:value}}});
    return choices;
  });
}
export async function requestBoonChoices(section,uuids){
  const gms=game.users.filter(u=>u.isGM).map(u=>u.id);
  if(!gms.length)throw new Error("No Storyteller account exists.");
  await ChatMessage.create({content:"Brazier boon selection request",whisper:gms,speaker:ChatMessage.getSpeaker(),flags:{[MODULE_ID]:{boonRequest:{section,uuids}}}});
}
export async function receiveBoonRequest(message){
  if(!game.user.isGM||!game.user.active)return;
  const primary=game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(primary?.id!==game.user.id)return;
  return serial("boon-requests",async()=>{
    const r=message.getFlag(MODULE_ID,"boonRequest"),userId=message.author?.id??message.user?.id;
    if(!r||message.getFlag(MODULE_ID,"boonProcessed")||!userId||game.users.get(userId)?.isGM)return;
    try{await setBoonChoices(r.section,r.uuids,userId,message.id);}
    catch(error){ui.notifications.warn(`Brazier selection rejected: ${error.message}`);}
    await message.setFlag(MODULE_ID,"boonProcessed",true);
  });
}
let indexPromise;
export function clearItemIndex(){indexPromise=undefined;}
export async function itemIndex(){
  gm();if(game.system?.id!=="pf2e")throw new Error("The PF2E system must be active to search its items.");
  return indexPromise??=(async()=>{
    const packs=[...game.packs].filter(p=>p.documentName==="Item"&&p.visible!==false);
    const result=await Promise.allSettled(packs.map(async pack=>{
      const index=await pack.getIndex({fields:["type","system.slug","system.usage.value","system.level.value","system.category","system.traits.value","system.traits.rarity"]});
      return [...index].map(i=>({uuid:i.uuid||`Compendium.${pack.collection}.Item.${i._id}`,name:i.name,slug:i.system?.slug,img:assetPath(i.img),type:i.type,usage:i.system?.usage?.value??"",level:i.system?.level?.value??0,category:i.system?.category??"",traits:i.system?.traits?.value??[],rarity:i.system?.traits?.rarity??"common",pack:pack.metadata.label||pack.collection}));
    }));
    const failed=result.filter(r=>r.status==="rejected");
    if(failed.length){indexPromise=undefined;ui.notifications.warn(`Brazier: ${failed.length} item compendium(s) could not be indexed. Reload the catalog to retry.`);}
    return result.flatMap(r=>r.status==="fulfilled"?r.value:[]).sort((a,b)=>a.name.localeCompare(b.name));
  })().catch(error=>{indexPromise=undefined;throw error;});
}
export function filterItems(items,filters){
  const q=(filters.query||"").trim().toLocaleLowerCase();
  const selected=filters.traits??(filters.trait?[filters.trait]:[]);
  return items.filter(i=>(!filters.type||i.type===filters.type)&&(!q||i.name.toLocaleLowerCase().includes(q))&&(!filters.category||i.category===filters.category)&&(!filters.rarity||i.rarity===filters.rarity)&&(!filters.pack||i.pack===filters.pack)&&(!selected.length||(filters.traitMode==="any"?selected.some(t=>i.traits.includes(t)):selected.every(t=>i.traits.includes(t))))&&i.level>=Number(filters.min||0)&&i.level<=Number(filters.max??30));
}
