import {clone,uid,ICONS} from './model.mjs';
const fail=message=>{throw new Error(message);};
export const integer=(v,min,max,label)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail(`Invalid ${label}.`);
export const text=(v,max,label,blank=true)=>typeof v==='string'&&v.length<=max&&(blank||v.trim())?v:fail(`Invalid ${label}.`);
export const validUuid=v=>v===''||/^(Actor|Item|Compendium)\.[A-Za-z0-9_.-]+$/.test(v);
export function freshCampaign(){return {schema:1,updatedAt:0,memories:[],shrouds:[],shroudCount:1,unlocks:{},prepared:{},runeTargets:{},caravan:{name:'The Caravan',description:'',location:'',journalUuid:'',actorUuid:'',people:[],facilities:[],projects:[],requests:[]},history:[],receipts:[],experimentalGrants:false};}
export function freshEntry(kind='memory'){return {id:uid(),kind,name:kind==='shroud'?'New Shroud':'New Memory',description:'',icon:kind==='shroud'?'moon':'book',iconUrl:'',sourceUuid:'',visibility:'all',users:[],minimumLevel:0,requires:[],group:'',cost:1,progress:0,total:5,status:'active',role:''};}
export function migrateCampaign(input){return {...freshCampaign(),...clone(input??{}),caravan:{...freshCampaign().caravan,...clone(input?.caravan??{})}};}
export function validateEntry(e){
  text(e.id,128,'entry ID',false);if(['__proto__','constructor','prototype'].includes(e.id))fail('Reserved entry ID.');
  text(e.name,120,'entry name',false);text(e.description,20000,'description');text(e.iconUrl??'',500,'art path');
  if(!Object.hasOwn(ICONS,e.icon))fail('Invalid entry icon.');
  if(!['all','selected','gm'].includes(e.visibility)||!Array.isArray(e.users)||e.users.some(id=>typeof id!=='string'||id.length>128)||new Set(e.users).size!==e.users.length)fail('Invalid entry visibility.');
  text(e.sourceUuid??'',500,'source UUID');if(!validUuid(e.sourceUuid??''))fail('Invalid source UUID.');
  integer(e.minimumLevel??0,0,30,'minimum level');integer(e.cost??1,1,9999,'shroud cost');
  if(!Array.isArray(e.requires)||e.requires.some(id=>typeof id!=='string'||id.length>128))fail('Invalid memory requirements.');
  text(e.group??'',100,'exclusive group');text(e.role??'',200,'role');integer(e.total??5,1,100000,'project total');integer(e.progress??0,0,e.total??5,'project progress');
  if(!['active','paused','complete'].includes(e.status??'active'))fail('Invalid project status.');return e;
}
export function validateCampaign(c){
  if(c.schema!==1)fail('Unsupported campaign schema.');integer(c.updatedAt,0,Number.MAX_SAFE_INTEGER,'campaign revision');integer(c.shroudCount,0,9999,'shroud capacity');
  const ids=new Set();for(const list of [c.memories,c.shrouds,c.caravan.people,c.caravan.facilities,c.caravan.projects]){
    if(!Array.isArray(list)||list.length>2000)fail('Invalid campaign catalog.');for(const e of list){validateEntry(e);if(ids.has(e.id))fail('Duplicate campaign entry ID.');ids.add(e.id);}
  }
  const lookup=new Map(c.memories.map(m=>[m.id,m]));
  for(const e of [...c.memories,...c.shrouds])if(e.requires.some(id=>!lookup.has(id)||id===e.id))fail('Unknown memory prerequisite.');
  const colors=new Map();for(const m of c.memories){const stack=[[m.id,false]];while(stack.length){const [id,done]=stack.pop();if(done){colors.set(id,2);continue;}if(colors.get(id)===1)fail('Circular memory prerequisites.');if(colors.get(id)===2)continue;colors.set(id,1);stack.push([id,true]);for(const dep of lookup.get(id).requires)stack.push([dep,false]);}}
  for(const key of ['unlocks','prepared','runeTargets']){if(!c[key]||typeof c[key]!=='object'||Array.isArray(c[key]))fail('Invalid player campaign state.');for(const id of Object.keys(c[key]))if(!id||id.length>128||['__proto__','constructor','prototype'].includes(id))fail('Reserved or invalid user ID.');}
  for(const [user,values] of Object.entries(c.unlocks)){text(user,128,'user ID',false);if(['__proto__','constructor','prototype'].includes(user))fail('Reserved user ID.');if(!Array.isArray(values)||values.some(id=>!lookup.has(id))||new Set(values).size!==values.length)fail('Invalid memory entitlement.');}
  for(const values of Object.values(c.prepared))if(!Array.isArray(values)||values.some(id=>typeof id!=='string')||new Set(values).size!==values.length)fail('Invalid prepared shrouds.');
  for(const value of Object.values(c.runeTargets))if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([uuid,id])=>!validUuid(uuid)||typeof id!=='string'||id.length>128))fail('Invalid rune targets.');
  for(const key of ['name','description','location','journalUuid','actorUuid'])text(c.caravan[key],key==='description'?20000:500,`caravan ${key}`);
  if(c.caravan.actorUuid&&!/^Actor\.[A-Za-z0-9_-]+$/.test(c.caravan.actorUuid))fail('Choose a world Party or loot actor.');
  if(c.caravan.journalUuid&&!/^JournalEntry\.[A-Za-z0-9_.-]+$/.test(c.caravan.journalUuid))fail('Invalid journal UUID.');
  if(!Array.isArray(c.history)||c.history.length>2000||!Array.isArray(c.receipts)||c.receipts.length>10000||!Array.isArray(c.caravan.requests)||c.caravan.requests.length>2000)fail('Campaign history limit reached. Export an archive before continuing.');
  if(typeof c.experimentalGrants!=='boolean')fail('Invalid integration setting.');return c;
}
export const visibleTo=(entry,user)=>user.isGM||entry.visibility==='all'||entry.visibility==='selected'&&entry.users.includes(user.id);
export function projectCampaign(c,user){
  if(user.isGM)return clone(c);
  const memories=c.memories.filter(e=>visibleTo(e,user)),allowed=new Set(memories.map(m=>m.id)),shrouds=c.shrouds.filter(e=>visibleTo(e,user)&&e.requires.every(id=>allowed.has(id))),shroudIds=new Set(shrouds.map(e=>e.id));
  return {schema:1,updatedAt:c.updatedAt,memories:clone(memories),shrouds:clone(shrouds),shroudCount:c.shroudCount,experimentalGrants:c.experimentalGrants,
    unlocks:{[user.id]:(c.unlocks[user.id]??[]).filter(id=>allowed.has(id))},prepared:{[user.id]:(c.prepared[user.id]??[]).filter(id=>shroudIds.has(id))},runeTargets:{[user.id]:clone(c.runeTargets[user.id]??{})},
    caravan:{...clone(c.caravan),people:clone(c.caravan.people.filter(e=>visibleTo(e,user))),facilities:clone(c.caravan.facilities.filter(e=>visibleTo(e,user))),projects:clone(c.caravan.projects.filter(e=>visibleTo(e,user))),requests:clone(c.caravan.requests.filter(r=>r.userId===user.id))},
    history:clone(c.history.filter(e=>e.userId===user.id&&(!e.entryId||allowed.has(e.entryId))).map(({id,when,action,summary,status})=>({id,when,action,summary,status}))),receipts:[]};
}
export function shroudEligibility(c,e,user){
  if(!visibleTo(e,user))return 'Not revealed to this player.';
  const level=user.character?.level??user.character?.system?.details?.level?.value;
  if(user.character?.type!=='character'||!Number.isInteger(level))return 'Assign a PF2E character in User Configuration.';
  if(level<(e.minimumLevel??0))return `Requires character level ${e.minimumLevel}.`;
  if(!e.requires.every(id=>(c.unlocks[user.id]??[]).includes(id)))return 'Requires an earned Memory.';return '';
}
export function validateShroudChoices(c,ids,user){
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail('Invalid shroud selection.');let cost=0;const groups=new Set();
  for(const id of ids){const e=c.shrouds.find(s=>s.id===id);if(!e)fail('Shroud no longer available.');const reason=shroudEligibility(c,e,user);if(reason)fail(reason);cost+=e.cost;if(e.group){if(groups.has(e.group))fail(`Choose only one shroud from ${e.group}.`);groups.add(e.group);}}
  if(cost>c.shroudCount)fail('Prepared shrouds exceed capacity.');return cost;
}
export function appendHistory(c,action,userId,summary,status='complete',id=uid()){
  if(c.history.length>=2000)fail('Campaign history limit reached. Export an archive before continuing.');c.history.push({id,when:Date.now(),action,userId,summary,status});return id;
}
