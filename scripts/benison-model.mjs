/** PF2E's numbered Additive values share one filter family. Preserve source traits. */
export const normalizeTrait=trait=>["additive","additive1","additive2","additive3"].includes(trait)?"additive":trait;
export const normalizedTraits=item=>[...new Set((item.traits??item.system?.traits?.value??[]).map(normalizeTrait))];
export const isBenisonConsumable=item=>["consumable","weapon","ammo"].includes(item?.type)&&(item.traits??item.system?.traits?.value??[]).includes("consumable");
export const DEFAULT_BANDS=Object.freeze({highMinimum:-1,middleMinimum:-4,highQuantity:1,middleQuantity:2,lowQuantity:3});
export function validateBands(bands){
  if(!bands||![bands.highMinimum,bands.middleMinimum].every(v=>Number.isSafeInteger(v)&&v>=-30&&v<=30)||bands.highMinimum<=bands.middleMinimum||![bands.highQuantity,bands.middleQuantity,bands.lowQuantity].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=9999))throw new Error("Quantity bands need descending integer minimums (−30 to 30) and positive integer amounts (1 to 9999).");
  return bands;
}
export function benisonAmount(level,itemLevel,bands=DEFAULT_BANDS){
  validateBands(bands);
  if(!Number.isSafeInteger(level)||level<0||!Number.isSafeInteger(itemLevel)||itemLevel<0)return null;
  const delta=itemLevel-level;
  return delta>=bands.highMinimum?bands.highQuantity:delta>=bands.middleMinimum?bands.middleQuantity:bands.lowQuantity;
}
export function assignedCharacter(user){
  const actor=user?.character;
  return actor?.type==="character"?actor:null;
}
export function characterLevel(user){
  const actor=assignedCharacter(user),level=actor?.level??actor?.system?.details?.level?.value;
  return Number.isSafeInteger(level)&&level>=0?level:null;
}
