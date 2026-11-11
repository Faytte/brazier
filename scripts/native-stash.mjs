import {campaignView} from './campaign-store.mjs';
import {viewingAs} from './perspective.mjs';

/** Resolve the existing document; never invent a second stash or change its permissions. */
export function stashActor(config=campaignView()){
  const uuid=config.caravan.actorUuid;
  const actor=uuid?[...game.actors].find(actor=>actor.uuid===uuid):game.actors.party;
  return actor&&['party','loot'].includes(actor.type)?actor:null;
}
export function stashPerspectiveBlocked(app){return game.user.isGM&&viewingAs(app).id!==game.user.id;}
/** Native PF2E owns every inventory listener, quantity dialog, transfer and currency operation. */
export async function openNativeStash(app){
  if(game.system.id!=='pf2e')throw Error('The party stash requires the PF2E game system.');
  if(stashPerspectiveBlocked(app))throw Error('The native stash uses your signed-in Foundry account. Return to Storyteller, or sign in as that player to use their stash permissions.');
  const actor=stashActor();
  if(!actor)throw Error('No PF2E party stash is available. Set an active party in PF2E, or choose a Party / loot override in Caravan Settings.');
  const sheet=actor.sheet;
  if(!sheet||typeof sheet.render!=='function')throw Error('This actor has no available inventory sheet.');
  // Match the configured native sheet's view permission, including LIMITED access.
  // Party members may be allowed to transfer items without owning the Party actor.
  if(!actor.testUserPermission(game.user,sheet.options?.viewPermission??'LIMITED'))throw Error('The stash is not shared with your Foundry account.');
  const V2=globalThis.foundry?.applications?.api?.ApplicationV2;
  if(V2&&sheet instanceof V2)await sheet.render({force:true,tab:'inventory'});
  else await sheet.render(true,{tab:'inventory',focus:true});
  return sheet;
}
