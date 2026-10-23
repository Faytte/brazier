import {ICONS,clone,uid} from "./model.mjs";
import {availableCurios,freshCurio,freshGift,saveCurio,syncCurio,curioWorldItem,boonCatalog,saveBoons,addConsumable,itemIndex,clearItemIndex,filterItems,escapeHTML as h,assetPath} from "./catalog.mjs";

const btn=(act,label,value="",extra="")=>`<button type="button" data-cat-act="${act}" data-value="${h(value)}" ${extra}>${label}</button>`;
const input=(field,value,type="text",extra="")=>`<input type="${type}" data-cat-field="${field}" value="${h(value)}" ${extra}>`;
const field=(label,html)=>`<label class="brazier-field"><span>${label}</span>${html}</label>`;
const select=(key,values,current,all=false)=>`<select data-cat-field="${key}">${all?'<option value="">All</option>':""}${values.map(v=>`<option value="${h(v)}" ${v===current?"selected":""}>${h(v)}</option>`).join("")}</select>`;
const icon=c=>assetPath(c.iconUrl)?`<img src="${h(c.iconUrl)}" alt="">`:`<i class="fa-solid ${ICONS[c.icon]||ICONS.gem}"></i>`;
const prose=value=>`<div class="brazier-prose">${h(value)}</div>`;

export function catalogHTML(app){return app.tab==="curio"?curioHTML(app):boonsHTML(app);}
function curioHTML(app){
  const all=availableCurios(),gm=game.user.isGM;
  const curio=app.curioDraft??all.find(c=>c.id===app.curioId);
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
  const b=boonCatalog(),section=app.boonSection??"consumables",gm=game.user.isGM;
  const sections={consumables:"Consumables",runes:"Runes",memories:"Memories and Shrouds"};
  return `<section class="brazier-boons"><nav class="brazier-subtabs" aria-label="Benison Boon sections">${Object.entries(sections).map(([key,label])=>btn("boon-section",label,key,`class="${section===key?"active":""}"`)).join("")}</nav><div class="brazier-catalog-body"><h2>${sections[section]}</h2>${section==="consumables"?`${gm?field("Global number of consumable choices",input("boons.count",app.consumableCountDraft??b.consumableCount,"number",'min="0" max="9999" step="1"'))+btn("save-boon-count","Save Choice Count"):`<p>Consumable choices: <strong>${b.consumableCount}</strong></p>`}<p class="brazier-note">One count for the whole consumable list. Distribution and daily selection will be added in a later update.</p>${gm?searchHTML(app):""}`:gm?`<p class="brazier-note">Add named options now. Item granting and further rules will follow in a later update.</p>${field("New option name",input("boons.optionName",app.boonOptionName??""))}${field("Details",`<textarea data-cat-field="boons.optionDescription">${h(app.boonOptionDescription??"")}</textarea>`)}${btn("add-boon-option","+ Add Option")}`:""}<h3>Available ${sections[section]}</h3><div class="brazier-curated-list">${b[section].map(i=>`<article><span><strong>${h(i.name)}</strong>${i.level!==undefined?` <small>Level ${h(i.level)} · ${h(i.category)}</small>`:""}${i.description?prose(i.description):""}</span>${i.uuid.startsWith("Compendium.")?btn("open-source","View",i.uuid):""}${gm?btn("remove-boon","Remove",i.uuid):""}</article>`).join("")||'<p>No options added yet.</p>'}</div></div></section>`;
}
function searchHTML(app){
  const f=app.itemFilters??={query:"",min:0,max:30,category:"",rarity:"",pack:"",trait:""};
  const index=(app.catalogIndex??[]).filter(i=>i.type==="consumable"),unique=k=>[...new Set(index.map(i=>i[k]).filter(Boolean))].sort();
  const results=filterItems(index,f),page=Math.min(app.itemPage??0,Math.max(0,Math.ceil(results.length/40)-1));app.itemPage=page;
  return `<fieldset><legend>PF2E consumable search</legend><div class="brazier-section-heading">${btn("load-items",app.catalogLoading?"Loading…":"Load / Reload Compendiums","",app.catalogLoading?"disabled":"")}<small>${results.length} matching items</small></div>${field("Name",input("filter.query",f.query,"search"))}<div class="brazier-filters">${field("Minimum level",input("filter.min",f.min,"number",'min="0" max="30"'))}${field("Maximum level",input("filter.max",f.max,"number",'min="0" max="30"'))}${field("Category",select("filter.category",unique("category"),f.category,true))}${field("Rarity",select("filter.rarity",unique("rarity"),f.rarity,true))}${field("Source compendium",select("filter.pack",unique("pack"),f.pack,true))}${field("Trait",select("filter.trait",[...new Set(index.flatMap(i=>i.traits))].sort(),f.trait,true))}</div>${btn("search-items","Apply Filters")}<div class="brazier-search-results">${results.slice(page*40,(page+1)*40).map(i=>`<article><span>${h(i.name)} <small>Level ${h(i.level)} · ${h(i.category)} · ${h(i.rarity)} · ${h(i.pack)}</small></span>${btn("open-source","View",i.uuid)}${btn("add-consumable","Add",i.uuid,boonCatalog().consumables.some(c=>c.uuid===i.uuid)?"disabled":"")}</article>`).join("")||'<p>Load compendiums or adjust filters.</p>'}</div><div class="brazier-pagination">${btn("item-prev","Previous","",page?"":"disabled")}<span>Page ${page+1} / ${Math.max(1,Math.ceil(results.length/40))}</span>${btn("item-next","Next","",(page+1)*40<results.length?"":"disabled")}</div></fieldset>`;
}
export async function catalogClick(app,event){
  const el=event.target.closest("[data-cat-act]");if(!el?.dataset.catAct)return false;
  const action=el.dataset.catAct,id=el.dataset.value;
  if(action==="select-curio"){
    if(app.curioDraft&&!window.confirm("Discard unsaved Curio changes?"))return true;
    app.curioId=id;app.curioDraft=game.user.isGM?clone(availableCurios().find(c=>c.id===id)):null;
  }else if(action==="boon-section"){if(!["consumables","runes","memories"].includes(id))return true;app.boonSection=id;}
  else if(action==="open-source"){const doc=await fromUuid(id);if(!doc||!doc.testUserPermission(game.user,"OBSERVER"))throw new Error("This source is unavailable or not shared with you.");await doc.sheet.render({force:true});}
  else{
    if(!game.user.isGM)throw new Error("Storyteller only.");
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
        case "load-items":app.catalogLoading=true;clearItemIndex();try{app.catalogIndex=await itemIndex();}finally{app.catalogLoading=false;}break;
        case "search-items":app.itemPage=0;break;
        case "item-prev":app.itemPage=Math.max(0,(app.itemPage??0)-1);break;
        case "item-next":app.itemPage=(app.itemPage??0)+1;break;
        case "add-consumable":await addConsumable(id);break;
        case "save-boon-count":{const b=boonCatalog();b.consumableCount=Number(app.element.querySelector('[data-cat-field="boons.count"]').value);await saveBoons(b);app.consumableCountDraft=null;break;}
        case "remove-boon":{const b=boonCatalog(),section=app.boonSection??"consumables";b[section]=b[section].filter(i=>i.uuid!==id);await saveBoons(b);break;}
        case "add-boon-option":{
          if(!["runes","memories"].includes(app.boonSection))break;
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
  if(!game.user.isGM)throw new Error("Storyteller only.");
  const value=el.type==="checkbox"?el.checked:el.value;
  if(key.startsWith("gift-filter.")){app.giftFilters??={};app.giftFilters[key.slice(12)]=value;app.giftPage=0;return true;}
  if(key.startsWith("filter.")){app.itemFilters??={};app.itemFilters[key.slice(7)]=value;app.itemPage=0;return true;}
  if(key==="boons.count")app.consumableCountDraft=Number(value);
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
