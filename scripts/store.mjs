import {MODULE_ID, freshTree, freshNode, validateTree, projectTree, isAccessible, purchase, clone} from "./model.mjs";
const FLAG="data";
const PERM_OBSERVER=2;
const defaultOwner = {default:0};
const writeQueues = new Map();
function serialTreeWrite(treeId, operation) {
  const prior=writeQueues.get(treeId) ?? Promise.resolve();
  const next=prior.catch(()=>{}).then(operation);
  writeQueues.set(treeId,next);
  void next.finally(()=>{if(writeQueues.get(treeId)===next) writeQueues.delete(treeId);}).catch(()=>{});
  return next;
}
const dataOf = document => document.getFlag(MODULE_ID, FLAG);
export const masters = () => game.user.isGM ? game.journal.filter(j=>dataOf(j)?.kind === "master") : [];
export const playerProjections = () => game.journal.filter(j=> {
  const d=dataOf(j);
  return d?.kind === "projection" && d.userId === game.user.id &&
    j.testUserPermission(game.user,"OBSERVER");
});
export function availableTrees() {
  if (game.user.isGM) return masters().map(doc=>({...clone(dataOf(doc).tree), _docId:doc.id}));
  return playerProjections().map(doc=>clone(dataOf(doc).view)).filter(Boolean);
}
export function masterById(id) {
  if (!game.user.isGM) return null;
  return masters().find(j=>dataOf(j).tree.id===id) ?? null;
}
export async function makeTree(name="New Skill Tree") {
  if (!game.user.isGM) throw new Error("Only a Storyteller can create trees.");
  const tree=freshTree(name);
  tree.nodes.push({...freshNode("First Spark", 0,0),icon:"flame",cost:1});
  validateTree(tree);
  return (await JournalEntry.create({name:`Brazier • ${tree.name} [Storyteller]`,
    ownership:defaultOwner, flags:{[MODULE_ID]:{[FLAG]:{kind:"master",tree}}}}));
}
async function saveTreeCore(tree){
  validateTree(tree);
  const doc=masterById(tree.id);
  if (!doc) throw new Error("Tree master not found.");
  const current=dataOf(doc).tree;
  if (current.updatedAt !== tree.updatedAt) throw new Error("Tree changed since it was loaded; refresh before saving. No changes were overwritten.");
  const copy=clone(tree);delete copy._docId;
  copy.updatedAt=Math.max(Date.now(),current.updatedAt+1);
  await doc.update({name:`Brazier • ${copy.name} [Storyteller]`, [`flags.${MODULE_ID}.${FLAG}`]:{kind:"master",tree:copy}});
  // Projection failures must never cause a successful purchase to be retried and charged twice.
  try { await syncProjections(copy); }
  catch(error) { console.error("Brazier: projection sync failed; a GM can retry by reloading the world",error); ui.notifications?.warn("Brazier: saved, but player views could not all be refreshed. Reload as Storyteller to retry."); }
  return copy;
}
export async function saveTree(tree) {
  if (!game.user.isGM) throw new Error("Only a Storyteller can modify trees.");
  return serialTreeWrite(tree.id,()=>saveTreeCore(tree));
}
export async function deleteTree(treeId) {
  if (!game.user.isGM) throw new Error("Only a Storyteller can delete trees.");
  // Serialize deletion with outstanding saves/purchases to prevent orphan projections.
  return serialTreeWrite(treeId, async()=>{
    const doc=masterById(treeId);
    if (!doc) return;
    for (const p of [...game.journal].filter(j => dataOf(j)?.kind === "projection" && dataOf(j).treeId === treeId)) await p.delete();
    await doc.delete();
  });
}
/** Separate observer-only Journal Entries enforce both tree membership and node fog. */
export async function syncProjections(tree) {
  if (!game.user.isGM) return;
  const existing=game.journal.filter(j => dataOf(j)?.kind === "projection" && dataOf(j).treeId === tree.id);
  for (const user of game.users.filter(u => !u.isGM)) {
    const view=projectTree(tree,user.id);
    const doc=existing.find(j=>dataOf(j).userId===user.id);
    if (!view) {
      if (doc) await doc.delete();
      continue;
    }
    const ownership={default:0,[user.id]:PERM_OBSERVER};
    const flags={[MODULE_ID]:{[FLAG]:{kind:"projection",userId:user.id,treeId:tree.id,view}}};
    if (doc) await doc.update({name:`Brazier • ${tree.name}`, ownership,
      [`flags.${MODULE_ID}.${FLAG}`]:flags[MODULE_ID][FLAG]});
    else await JournalEntry.create({name:`Brazier • ${tree.name}`,ownership,flags});
  }
  for (const doc of existing) if (!game.users.has(dataOf(doc).userId)) await doc.delete();
}
export async function refreshAll() {
  if (!game.user.isGM) return;
  for (const doc of masters()) await syncProjections(dataOf(doc).tree);
}
export async function spendPoint(treeId,nodeId,requesterId,requestId=null) {
  if (!game.user.isGM) throw new Error("Storyteller only.");
  return serialTreeWrite(treeId,async()=>{
    const doc=masterById(treeId);
    if (!doc) throw new Error("Tree not found.");
    const tree=clone(dataOf(doc).tree);
    if (!game.users.get(requesterId)) throw new Error("Requesting player does not exist.");
    // The receipt is written atomically with the purchase into the master document.
    // If the separate ChatMessage processed flag fails, retrying cannot charge again.
    if (requestId !== null) {
      if (typeof requestId !== "string" || !requestId || requestId.length > 128) throw new Error("Invalid request ID.");
      if (tree.requestIds?.includes(requestId)) return {duplicate:true};
      if ((tree.requestIds?.length ?? 0) >= 10000) throw new Error("Purchase request history limit reached.");
    }
    const outcome=purchase(tree,nodeId,requesterId,Boolean(game.users.get(requesterId)?.isGM));
    if (requestId !== null) (tree.requestIds ??= []).push(requestId);
    await saveTreeCore(tree);
    return outcome;
  });
}
/** Player actions go through Foundry-created ChatMessages. GM reads server-authored author ID. */
export async function requestPurchase(treeId,nodeId) {
  if (game.user.isGM) return spendPoint(treeId,nodeId,game.user.id);
  const tree=availableTrees().find(t=>t.id===treeId);
  if (!tree?.nodes.some(n=>n.id===nodeId)) throw new Error("Talent not visible.");
  const gms=game.users.filter(u=>u.isGM).map(u=>u.id);
  if (!gms.length) throw new Error("No Storyteller account exists.");
  await ChatMessage.create({
    content:`Brazier upgrade request: ${tree.name}`,
    whisper:gms, speaker:ChatMessage.getSpeaker(),
    flags:{[MODULE_ID]:{request:{treeId,nodeId}}}
  });
}
let processing=new Set();
let requestQueue=Promise.resolve();
export function receiveRequest(message) {
  requestQueue=requestQueue.then(()=>processRequest(message)).catch(error=>console.error("Brazier request",error));
  return requestQueue;
}
async function processRequest(message) {
  if (!game.user.isGM || !game.user.active) return;
  const primary=game.users.filter(u=>u.isGM && u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if (primary?.id!==game.user.id) return; // One GM processor prevents concurrent spends.
  const request=message.getFlag(MODULE_ID,"request");
  if (!request || typeof request.treeId!=="string" || typeof request.nodeId!=="string" ||
      processing.has(message.id) || message.getFlag(MODULE_ID,"processed")) return;
  const requesterId=message.author?.id ?? message.user?.id;
  if (!requesterId || game.users.get(requesterId)?.isGM) return;
  processing.add(message.id);
  try {
    const outcome=await spendPoint(request.treeId,request.nodeId,requesterId,message.id);
    await message.setFlag(MODULE_ID,"processed",true);
    if (!outcome.duplicate) ui.notifications.info(`Brazier: ${game.users.get(requesterId)?.name} unlocked ${outcome.node.name}.`);
  } catch(err) {
    try {await message.setFlag(MODULE_ID,"processed",true);}
    catch(flagError){console.error("Brazier: could not mark request processed",flagError);}
    ui.notifications.warn(`Brazier request rejected: ${err.message}`);
  } finally { processing.delete(message.id); }
}
export async function processPendingRequests() {
  if (!game.user.isGM) return;
  const messages=[...(game.messages?.contents ?? [])];
  for (const m of messages) if (m.getFlag(MODULE_ID,"request") && !m.getFlag(MODULE_ID,"processed")) await receiveRequest(m);
}
