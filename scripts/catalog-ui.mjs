import {viewingAs,storyteller} from "./perspective.mjs";
import {normalizedTraits,isBenisonConsumable,characterLevel,benisonAmount} from "./benison-model.mjs";
import {ICONS,clone,uid} from "./model.mjs";
import {availableCurios,freshCurio,freshGift,saveCurio,syncCurio,curioWorldItem,boonCatalog,saveBoons,addConsumable,addRune,runeKind,boonChoices,setBoonChoices,requestBoonChoices,itemIndex,clearItemIndex,filterItems,escapeHTML as h,assetPath} from "./catalog.mjs";

const btn=(act,label,value="",extra="")=>`<button type="button" data-cat-act="${act}" data-value="${h(value)}" ${extra}>${label}</button>`;
const input=(field,value,type="text",extra="")=>`<input type="${type}" data-cat-field="${field}" value="${h(value)}" ${extra}>`;
const field=(label,html)=>`<label class="brazier-field"><span>${label}</span>${html}</label>`;
const select=(key,values,current,all=false)=>`<select data-cat-field="${key}">${all?'<option value="">All</option>':""}${values.map(v=>`<option value="${h(v)}" ${v===current?"selected":""}>${h(v)}</option>`).join("")}</select>`;
const icon=c=>assetPath(c.iconUrl)?`<img src="${h(c.iconUrl)}" alt="">`:`<i class="fa-solid ${ICONS[c.icon]||ICONS.gem}"></i>`;
const prose=value=>`<div class="brazier-prose">${h(value)}</div>`;

export function catalogHTML(app){return app.tab==="curio"?curioHTML(app):boonsHTML(app);}
function curioHTML(app){
  const gm=storyteller(app),all=availableCurios(viewingAs(app));
  const curio=(gm?app.curioDraft:null)??all.find(c=>c.id===app.curioId);
  return `<section class="brazier-catalog"><aside class="brazier-catalog-list"><h2>Curio</h2>${gm?btn("new-curio","+ New Curio"):""}${all.map(c=>btn("select-curio",`${icon(c)}<span>${h(c.name)}</span>${c.locked?'<i class="fa-solid fa-lock"></i>':""}`,c.id,`class="brazier-catalog-choice ${curio?.id===c.id?"active":""}"`)).join("")||'<p>No curios yet.</p>'}</aside><div class="brazier-catalog-body">${!curio?'<div class="brazier-empty"><h2>Curio collection</h2><p>Select a Curio to view it.</p></div>':gm?editCurio(app,curio):viewCurio(curio)}</div></section>`;
}
function editCurio(app,c){
  return `<div class="brazier-section-heading"><h2>${icon(c)} ${h(c.name)}</h2><div>${btn("save-curio","Save Curio & Sync Item","",app.catalogBusy?"disabled":"")}${btn("discard-curio","Discard Changes")}${c.updatedAt?btn("sync-curio","Retry Item Sync",c.id):""}${curioWorldItem(c.id)?btn("open-curio-item","Open Item",c.id):""}</div></div>
    <p class="brazier-note">Names and icons are public. Description and gifts are visible only to selected players. Save creates or updates the PF2E equipment item. Gifts are recorded as item text and source links; this editor does not automatically apply their mechanics. Giving an item to an actor also reveals its details to that actor’s owners.</p>
    <div class="brazier-two">${field("Name",input("curio.name",c.name,"text",'maxlength="120"'))}${field("Built-in icon",select("curio.icon",Object.keys(ICONS),c.icon))}</div>
    ${field("Custom art",input("curio.iconUrl",c.iconUrl,"text",'placeholder="Image path or HTTPS URL"'))}${btn("browse-curio","Browse / Upload Art")}
    ${field("Private description",`<textarea rows="4" maxlength="20000" data-cat-field="curio.description">${h(c.description)}</textarea>`)}
    <fieldset><legend>Players allowed to see details</legend>${game.users.filter(u=>!u.isGM).map(u=>`<label class="brazier-checkbox"><input type="checkbox" data-cat-field="curio.users" data-user="${h(u.id)}" ${c.users.includes(u.id)?"checked":""}>${h(u.name)}</label>`).join("")||"No player accounts."}</fieldset>
    <div class="brazier-section-heading"><h3>Relic Gifts (${c.gifts.length})</h3>${btn("add-gift","+ Add Relic Gift")}</div>
    ${c.gifts.map(g=>`<fieldset data-gift="${h(g.id)}"><legend>${h(g.name)}</legend><div class="brazier-two">${field("Gift name",input("gift.name",g.name,"text",'maxlength="120"'))}${field("Gift tier",select("gift.tier",["minor","major","grand"],g.tier))}</div>${field("Aspect",input("gift.aspect",g.aspect,"text",'maxlength="120"'))}${field("Effect / activation / frequency",`<textarea rows="3" maxlength="20000" data-cat-field="gift.description">${h(g.description)}</textarea>`)}${field("Optional source Item UUID",input("gift.sourceUuid",g.sourceUuid))}${btn("browse-gifts","Choose Compendium Gift",g.id)}${btn("import-gift","Import Name & Text from UUID",g.id)}${btn("remove-gift","Remove Gift",g.id)}</fieldset>`).join("")}${app.giftPicker?giftSearchHTML(app):""}`;
}
function giftSearchHTML(app){
  const f=app.giftFilters??={query:"",pack:"",min:0,max:30};
  const results=filterItems(app.catalogIndex??[],f),page=Math.min(app.giftPage??0,Math.max(0,Math.ceil(results.length/40)-1));app.giftPage=page;
  return `<fieldset><legend>Compendium Gift Picker</legend><p>Search installed Item compendiums, including relic-gift packs. Choose a gift to copy its name and text; set its tier and aspect in the editor.</p>${btn("load-items",app.catalogLoading?"Loading…":"Load / Reload Compendiums","",app.catalogLoading?"disabled":"")}${field("Gift name",input("gift-filter.query",f.query,"search"))}${field("Compendium",select("gift-filter.pack",[...new Set((app.catalogIndex??[]).map(i=>i.pack))].sort(),f.pack,true))}${btn("search-gifts","Search Gifts")}<small>${results.length} matching items</small><div class="brazier-search-results">${results.slice(page*40,(page+1)*40).map(i=>`<article><span>${h(i.name)} <small>${h(i.pack)} · ${h(i.type)}</small></span>${btn("choose-gift","Use Gift",i.uuid)}</article>`).join("")||"<p>Load compendiums to search.</p>"}</div><div class="brazier-pagination">${btn("gift-prev","Previous","",page?"":"disabled")}<span>Page ${page+1}</span>${btn("gift-next","Next","",(page+1)*40<results.length?"":"disabled")}${btn("close-gifts","Close Picker")}</div></fieldset>`;
}
async function importGift(gift){
  if(!gift?.sourceUuid)throw new Error("Enter or select a source Item UUID first.");
  const source=await fromUuid(gift.sourceUuid);
  if(source?.documentName!=="Item"||!source.testUserPermission(game.user,"OBSERVER"))throw new Error("Gift Item source unavailable.");
  const text=new DOMParser().parseFromString(source.system.description.value,"text/html");
  for(const secret of text.querySelectorAll(".secret,script,style"))secret.remove();
  for(const line of text.querySelectorAll("p,h1,h2,h3,h4,li,br"))line.append(text.createTextNode("\n"));
  gift.name=source.name;gift.description=text.body.textContent.trim();
}
function viewCurio(c){
  return `<div class="brazier-section-heading"><h2>${icon(c)} ${h(c.name)}</h2></div>${c.locked?'<p class="brazier-locked"><i class="fa-solid fa-lock"></i> Your Storyteller has not revealed this Curio’s details to you.</p>':`${prose(c.description)}<h3>Relic Gifts</h3>${c.gifts.map(g=>`<article class="brazier-gift"><h3>${h(g.name)}</h3><small>${h(g.tier)} gift${g.aspect?` · ${h(g.aspect)}`:""}</small>${prose(g.description)}${g.sourceUuid?btn("open-source","View Gift Source",g.sourceUuid):""}</article>`).join("")||'<p>No gifts revealed.</p>'}`}`;
}
function boonsHTML(app){
  const b=boonCatalog(),section=app.boonSection??"consumables",gm=storyteller(app),manage=gm&&app.catalogMode==="manage";
  const sections={consumables:"Consumables",runes:"Runes",memories:"Memories and Shrouds"},searchable=section!=="memories";
  const countKey=section==="runes"?"runeCount":"consumableCount",limit=section==="memories"?b.memories.length:b[countKey];
  const user=viewingAs(app);app.choiceDrafts??={};
  const draftKey=`${user.id}:${section}`,saved=boonChoices(user)[section]??[];
  const chosen=(app.choiceDrafts[draftKey]??saved).filter(id=>b[section].some(i=>i.uuid===id));
  return `<section class="brazier-boons"><nav class="brazier-subtabs" aria-label="Benison Boon sections">${Object.entries(sections).map(([key,label])=>btn("boon-section",label,key,`class="${section===key?"active":""}"`)).join("")}</nav><div class="brazier-catalog-body"><div class="brazier-section-heading"><h2>${sections[section]}</h2>${gm?`<div class="brazier-mode-toggle" aria-label="Catalog mode">${btn("catalog-mode","Overview","overview",`aria-pressed="${!manage}"`)}${btn("catalog-mode","Manage Options","manage",`aria-pressed="${manage}"`)}</div>`:""}</div>
  ${searchable?gm?`<div class="brazier-choice-count">${field(`Global number of ${section==="runes"?"rune":"consumable"} choices`,input("boons.count",app.countDrafts?.[section]??b[countKey],"number",'min="0" max="9999" step="1"'))}${btn("save-boon-count","Save Choice Count")}</div>`:`<p>Choose up to <strong>${limit}</strong> ${sections[section].toLowerCase()}.</p>`:""}
  ${gm&&section==="consumables"?quantityBandsHTML(app,b):""}
  ${manage&&searchable?searchHTML(app,section):""}
  ${manage&&!searchable?`${field("New option name",input("boons.optionName",app.boonOptionName??""))}${field("Details",`<textarea data-cat-field="boons.optionDescription">${h(app.boonOptionDescription??"")}</textarea>`)}${btn("add-boon-option","+ Add Option")}`:""}
  ${!gm&&section==="consumables"?`<p class="brazier-note">Character: ${h(user.character?.name??"Not assigned")} · Level ${characterLevel(user)??"—"}${characterLevel(user)===null?". Assign a PF2E character to this player before choosing consumables.":""}</p>`:""}
  <h3>Current Options (${b[section].length})</h3>${!gm&&section==="consumables"?consumableChoicesHTML(app,user,b,chosen):`<div class="brazier-curated-list">${b[section].map(i=>`<article><span><strong>${h(i.name)}</strong>${i.level!==undefined?` <small>Level ${h(i.level)} · ${h(i.category)}</small>`:""}${i.description?prose(i.description):""}</span>${i.uuid.startsWith("Compendium.")?btn("open-source","View",i.uuid):""}${manage?btn("remove-boon","Remove",i.uuid):""}${!gm?btn("toggle-choice",chosen.includes(i.uuid)?"Selected ✓":"Choose",i.uuid,`aria-pressed="${chosen.includes(i.uuid)}"`):""}</article>`).join("")||'<p>No options added yet.</p>'}</div>`}
  ${!gm?`<div class="brazier-choice-footer"><span>${chosen.length} / ${limit} selected</span>${btn("save-choices","Save Choices","",chosen.length>limit?"disabled":"")}${btn("clear-choices","Clear Choices")}<small>Saved consumables are created on the assigned character during PF2e Dailies preparation. Changes apply at the next preparation; runes and memories remain selections only.</small></div>`:""}</div></section>`;
}
function consumableChoicesHTML(app,user,b,chosen){
  const level=characterLevel(user),full=chosen.length>=b.consumableCount;
  return `<table class="brazier-consumable-choices"><thead><tr><th scope="col">Select</th><th scope="col">Consumable</th><th scope="col">Level</th><th scope="col">Amount</th><th scope="col">Details</th></tr></thead><tbody>${b.consumables.map(item=>{
    const checked=chosen.includes(item.uuid),disabled=level===null||!checked&&full;
    return `<tr class="${disabled?"unavailable":""}"><td><input type="checkbox" data-cat-field="choice.consumables" data-option="${h(item.uuid)}" aria-label="Select ${h(item.name)}" ${checked?"checked":""} ${disabled?"disabled":""}></td><td>${h(item.name)}</td><td>${h(item.level??"—")}</td><td class="brazier-amount">${checked?(benisonAmount(level,item.level,b.quantityBands)??"—"):"—"}</td><td>${item.uuid.startsWith("Compendium.")?btn("open-source","View",item.uuid):""}</td></tr>`;
  }).join("")||'<tr><td colspan="5">No consumables added yet.</td></tr>'}</tbody></table>`;
}
function quantityBandsHTML(app,b){
  const bands=app.quantityBandDraft??b.quantityBands;
  return `<details class="brazier-quantity-settings"><summary>Consumable quantity bands</summary><p>Minimum level is relative to the assigned character. Higher items use the first tier; lower than the second minimum uses the last tier.</p><table><thead><tr><th>Tier</th><th>Minimum level offset</th><th>Amount per selected option</th></tr></thead><tbody><tr><td>Highest</td><td>${input("bands.highMinimum",bands.highMinimum,"number",'min="-30" max="30" step="1" aria-label="Highest tier minimum level"')}</td><td>${input("bands.highQuantity",bands.highQuantity,"number",'min="1" max="9999" step="1" aria-label="Highest tier amount"')}</td></tr><tr><td>Middle</td><td>${input("bands.middleMinimum",bands.middleMinimum,"number",'min="-30" max="30" step="1" aria-label="Middle tier minimum level"')}</td><td>${input("bands.middleQuantity",bands.middleQuantity,"number",'min="1" max="9999" step="1" aria-label="Middle tier amount"')}</td></tr><tr><td>Lowest</td><td>Anything below the middle minimum</td><td>${input("bands.lowQuantity",bands.lowQuantity,"number",'min="1" max="9999" step="1" aria-label="Lowest tier amount"')}</td></tr></tbody></table>${btn("save-bands","Save Quantity Bands")}</details>`;
}
function sectionIndex(app,section){
  return (app.catalogIndex??[]).flatMap(i=>section==="runes"?(runeKind(i)?[{...i,category:runeKind(i)}]:[]):isBenisonConsumable(i)?[i]:[]);
}
function filtersFor(app,section){app.boonFilters??={};return app.boonFilters[section]??={query:"",min:0,max:30,category:"",rarity:"",pack:"",traits:[],traitMode:"all",traitQuery:""};}
function traitLabel(trait){const key=globalThis.CONFIG?.PF2E?.consumableTraits?.[trait]??globalThis.CONFIG?.PF2E?.equipmentTraits?.[trait];return key&&game.i18n?.localize?game.i18n.localize(key):trait.replace(/([a-z])(\d)/g,"$1 $2").replaceAll("-"," ").replace(/\b\w/g,c=>c.toUpperCase());}
function searchHTML(app,section){
  const f=filtersFor(app,section),index=sectionIndex(app,section),unique=k=>[...new Set(index.map(i=>i[k]).filter(Boolean))].sort();
  const results=filterItems(index,f);app.itemPages??={};const page=Math.min(app.itemPages[section]??0,Math.max(0,Math.ceil(results.length/40)-1));app.itemPages[section]=page;
  const pool=filterItems(index,{...f,traits:[]}),counts=new Map();
  for(const i of pool)for(const t of normalizedTraits(i))counts.set(t,(counts.get(t)??0)+1);
  for(const t of f.traits??[])if(!counts.has(t))counts.set(t,0);
  const traits=[...counts.keys()].sort((a,b)=>Number(f.traits.includes(b))-Number(f.traits.includes(a))||traitLabel(a).localeCompare(traitLabel(b)));
  return `<fieldset><legend>PF2E ${section==="runes"?"property rune":"consumable"} search</legend><div class="brazier-section-heading">${btn("load-items",app.catalogLoading?"Loading…":"Load / Reload Compendiums","",app.catalogLoading?"disabled":"")}<small>${results.length} matching items</small></div>${field("Name",input("filter.query",f.query,"search"))}<div class="brazier-filters">${field("Minimum level",input("filter.min",f.min,"number",'min="0" max="30"'))}${field("Maximum level",input("filter.max",f.max,"number",'min="0" max="30"'))}${field(section==="runes"?"Rune target (item = accessory)":"Category",select("filter.category",unique("category"),f.category,true))}${field("Rarity",select("filter.rarity",unique("rarity"),f.rarity,true))}${field("Source compendium",select("filter.pack",unique("pack"),f.pack,true))}</div>
  <fieldset class="brazier-traits"><legend>Traits · ${(f.traits??[]).length} selected</legend><div class="brazier-two">${field("Find traits",input("filter.traitQuery",f.traitQuery,"search"))}${field("Match selected traits",select("filter.traitMode",["all","any"],f.traitMode))}</div><div class="brazier-trait-options">${traits.map(t=>`<label class="brazier-trait-option" data-trait-name="${h(traitLabel(t).toLocaleLowerCase())}" ${!traitLabel(t).toLocaleLowerCase().includes(f.traitQuery.toLocaleLowerCase())&&!f.traits.includes(t)?"hidden":""}><input type="checkbox" data-cat-field="filter.traits" data-trait="${h(t)}" ${f.traits.includes(t)?"checked":""}><span>${h(traitLabel(t))}</span><small>${counts.get(t)}</small></label>`).join("")||"<p>No traits in the current item pool.</p>"}</div>${btn("clear-traits","Clear Traits")}<small>Only traits on matching ${section==="runes"?"runes":"consumables"}. Select several; “all” requires every trait, “any” requires at least one.</small></fieldset>
  ${btn("search-items","Apply Filters")}<div class="brazier-search-results">${results.slice(page*40,(page+1)*40).map(i=>`<article><span>${h(i.name)} <small>Level ${h(i.level)} · ${h(i.category)} · ${h(i.rarity)} · ${h(i.pack)}</small></span>${btn("open-source","View",i.uuid)}${btn(section==="runes"?"add-rune":"add-consumable","Add",i.uuid,boonCatalog()[section].some(c=>c.uuid===i.uuid)?"disabled":"")}</article>`).join("")||'<p>Load compendiums or adjust filters.</p>'}</div><div class="brazier-pagination">${btn("item-prev","Previous","",page?"":"disabled")}<span>Page ${page+1} / ${Math.max(1,Math.ceil(results.length/40))}</span>${btn("item-next","Next","",(page+1)*40<results.length?"":"disabled")}</div></fieldset>`;
}
export async function catalogClick(app,event){
  const el=event.target.closest("[data-cat-act]");if(!el?.dataset.catAct)return false;
  const action=el.dataset.catAct,id=el.dataset.value;
  if(action==="select-curio"){
    if(storyteller(app)&&app.curioDraft&&!window.confirm("Discard unsaved Curio changes?"))return true;
    app.curioId=id;if(storyteller(app))app.curioDraft=clone(availableCurios().find(c=>c.id===id));
  }else if(action==="boon-section"){if(!["consumables","runes","memories"].includes(id))return true;app.boonSection=id;}
  else if(action==="open-source"){const doc=await fromUuid(id);if(!doc||!doc.testUserPermission(viewingAs(app),"OBSERVER"))throw new Error("This source is unavailable or not shared with you.");await doc.sheet.render({force:true});}
  else if(["toggle-choice","save-choices","clear-choices"].includes(action)){
    const user=viewingAs(app),section=app.boonSection??"consumables",b=boonCatalog();
    if(user.isGM)throw new Error("Select a player using View as first.");
    app.choiceDrafts??={};const key=`${user.id}:${section}`;
    const chosen=app.choiceDrafts[key]??=clone(boonChoices(user)[section]??[]);
    if(action==="toggle-choice"){if(!b[section].some(i=>i.uuid===id))throw new Error("Option no longer available.");app.choiceDrafts[key]=chosen.includes(id)?chosen.filter(i=>i!==id):[...chosen,id];}
    if(action==="clear-choices")app.choiceDrafts[key]=[];
    if(action==="save-choices"){
      const choices=(app.choiceDrafts[key]??[]).filter(id=>b[section].some(i=>i.uuid===id));
      if(game.user.isGM){await setBoonChoices(section,choices,user.id);delete app.choiceDrafts[key];ui.notifications.info(`Brazier: choices saved for ${user.name}.`);}
      else{await requestBoonChoices(section,choices);ui.notifications.info("Brazier: selections requested. An active Storyteller validates and saves them.");}
    }
  }
  else{
    if(!storyteller(app))throw new Error("Storyteller only.");
    if(app.catalogBusy)return true;
    app.catalogBusy=true;
    try{
      const c=app.curioDraft;
      switch(action){
        case "new-curio":if(c&&!window.confirm("Discard unsaved Curio changes?"))return true;app.curioDraft=freshCurio();app.curioId=app.curioDraft.id;break;
        case "discard-curio":app.curioDraft=null;app.curioId=null;app.giftPicker=null;break;
        case "save-curio":if(c){try{app.curioDraft=await saveCurio(c);}catch(error){if(error.savedCurio)app.curioDraft=clone(error.savedCurio);throw error;}ui.notifications.info("Brazier: Curio saved and item synchronized.");}break;
        case "sync-curio":await syncCurio(id);ui.notifications.info("Brazier: Curio item synchronized.");break;
        case "open-curio-item":await curioWorldItem(id)?.sheet.render({force:true});break;
        case "add-gift":if(c)c.gifts.push(freshGift());break;
        case "remove-gift":if(c)c.gifts=c.gifts.filter(g=>g.id!==id);break;
        case "import-gift":await importGift(c?.gifts.find(g=>g.id===id));break;
        case "browse-gifts":app.giftPicker=id;break;
        case "choose-gift":{const gift=c?.gifts.find(g=>g.id===app.giftPicker);if(gift){gift.sourceUuid=id;await importGift(gift);}app.giftPicker=null;break;}
        case "close-gifts":app.giftPicker=null;break;
        case "search-gifts":app.giftPage=0;break;
        case "gift-prev":app.giftPage=Math.max(0,(app.giftPage??0)-1);break;
        case "gift-next":app.giftPage=(app.giftPage??0)+1;break;
        case "browse-curio":{
          if(!c)break;const captured=c;
          const Picker=foundry.applications.apps.FilePicker;
          await new Picker({type:"image",callback:async path=>{if(assetPath(path)){captured.iconUrl=path;await app._refresh();}}}).render({force:true});break;
        }
        case "load-items":app.catalogLoading=true;await app._refresh();clearItemIndex();try{app.catalogIndex=await itemIndex();}finally{app.catalogLoading=false;}break;
        case "catalog-mode":if(["overview","manage"].includes(id))app.catalogMode=id;break;
        case "clear-traits":filtersFor(app,app.boonSection??"consumables").traits=[];break;
        case "search-items":app.itemPages??={};app.itemPages[app.boonSection??"consumables"]=0;break;
        case "item-prev":{const k=app.boonSection??"consumables";app.itemPages??={};app.itemPages[k]=Math.max(0,(app.itemPages[k]??0)-1);break;}
        case "item-next":{const k=app.boonSection??"consumables";app.itemPages??={};app.itemPages[k]=(app.itemPages[k]??0)+1;break;}
        case "add-consumable":await addConsumable(id);break;
        case "add-rune":await addRune(id);break;
        case "save-bands":{const b=boonCatalog();b.quantityBands={...b.quantityBands,...app.quantityBandDraft};await saveBoons(b);app.quantityBandDraft=null;break;}
        case "save-boon-count":{const b=boonCatalog();b[app.boonSection==="runes"?"runeCount":"consumableCount"]=Number(app.element.querySelector('[data-cat-field="boons.count"]').value);await saveBoons(b);app.countDrafts??={};delete app.countDrafts[app.boonSection??"consumables"];break;}
        case "remove-boon":{const b=boonCatalog(),section=app.boonSection??"consumables";b[section]=b[section].filter(i=>i.uuid!==id);await saveBoons(b);break;}
        case "add-boon-option":{
          if(app.boonSection!=="memories")break;
          const name=app.boonOptionName?.trim();if(!name)throw new Error("Enter an option name.");
          const b=boonCatalog();b[app.boonSection].push({uuid:`brazier:${uid()}`,name,description:app.boonOptionDescription??""});await saveBoons(b);app.boonOptionName="";app.boonOptionDescription="";break;
        }
      }
    }finally{app.catalogBusy=false;}
  }
  await app._refresh();return true;
}
export async function catalogChange(app,event){
  const el=event.target,key=el.dataset.catField;if(!key)return false;
  const value=el.type==="checkbox"?el.checked:el.value;
  if(key==="choice.consumables"){
    if(event.type==="input")return true;
    const user=viewingAs(app),b=boonCatalog();if(user.isGM)throw new Error("View as a player before making choices.");
    if(value&&characterLevel(user)===null)throw new Error("This player needs an assigned PF2E character.");
    app.choiceDrafts??={};const draftKey=`${user.id}:consumables`,chosen=app.choiceDrafts[draftKey]??=clone(boonChoices(user).consumables);
    if(!b.consumables.some(i=>i.uuid===el.dataset.option))throw new Error("Consumable no longer available.");
    if(value&&!chosen.includes(el.dataset.option)&&chosen.length>=b.consumableCount)throw new Error("The consumable choice limit has been reached.");
    app.choiceDrafts[draftKey]=value?[...new Set([...chosen,el.dataset.option])]:chosen.filter(id=>id!==el.dataset.option);
    await app._refresh();return true;
  }
  if(!storyteller(app))throw new Error("Storyteller only.");
  if(key.startsWith("bands.")){app.quantityBandDraft??=clone(boonCatalog().quantityBands);app.quantityBandDraft[key.slice(6)]=Number(value);return true;}
  if(key.startsWith("gift-filter.")){app.giftFilters??={};app.giftFilters[key.slice(12)]=value;app.giftPage=0;return true;}
  if(key.startsWith("filter.")){
    const section=app.boonSection??"consumables",f=filtersFor(app,section),part=key.slice(7);app.itemPages??={};app.itemPages[section]=0;
    if(part==="traits"){
      f.traits=value?[...new Set([...f.traits,el.dataset.trait])]:f.traits.filter(t=>t!==el.dataset.trait);
      if(event.type!=="input")await app._refresh();
    }else f[part]=value;
    if(part==="traitQuery")for(const label of app.element.querySelectorAll(".brazier-trait-option"))label.hidden=!label.dataset.traitName.includes(value.toLocaleLowerCase())&&!label.querySelector("input").checked;
    return true;
  }
  if(key==="boons.count"){app.countDrafts??={};app.countDrafts[app.boonSection??"consumables"]=Number(value);}
  else if(key==="boons.optionName")app.boonOptionName=value;
  else if(key==="boons.optionDescription")app.boonOptionDescription=value;
  else if(app.curioDraft){
    const c=app.curioDraft;
    if(key==="curio.users"){c.users=value?[...new Set([...c.users,el.dataset.user])]:c.users.filter(id=>id!==el.dataset.user);}
    else if(["curio.name","curio.description","curio.icon","curio.iconUrl"].includes(key))c[key.slice(6)]=value;
    else if(["gift.name","gift.description","gift.tier","gift.aspect","gift.sourceUuid"].includes(key)){const g=c.gifts.find(g=>g.id===el.closest("[data-gift]").dataset.gift);if(g)g[key.slice(5)]=value;}
  }
  return true;
}
