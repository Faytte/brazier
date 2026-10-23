import {ICONS, BACKGROUNDS, LINES, VISIBILITIES, freshNode, uid, clone, rankOf, progressFor, canBuy, validateTree} from "./model.mjs";
import {availableTrees, makeTree, saveTree, deleteTree, requestPurchase, spendPoint} from "./store.mjs";
import {viewingAs,storyteller,setPerspective} from "./perspective.mjs";
import {catalogHTML,catalogClick,catalogChange} from "./catalog-ui.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const h = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
const okColor = s => /^#[0-9a-f]{6}$/i.test(s) ? s : "#b9986b";
const safeAsset = s => typeof s === "string" && s.length < 500 && !/[<>"'`\\\r\n]/.test(s) && !/^\s*(javascript:|data:)/i.test(s) ? s : "";
const pretty = x => x.charAt(0).toUpperCase()+x.slice(1);
const options = (values, active) => values.map(v=>`<option value="${h(v)}" ${v===active?"selected":""}>${h(pretty(v))}</option>`).join("");
const iconHtml = (icon, image="") => safeAsset(image)
  ? `<img src="${h(safeAsset(image))}" alt="">`
  : `<i class="fa-solid ${ICONS[icon] || ICONS.star}"></i>`;
const formRow = (label, contents) => `<label class="brazier-field"><span>${h(label)}</span>${contents}</label>`;
const textInput = (path,val,placeholder="") => `<input type="text" data-field="${h(path)}" value="${h(val)}" placeholder="${h(placeholder)}">`;
const numInput = (path,val,min=0,max=9999) => `<input type="number" data-field="${h(path)}" value="${Number(val)||0}" min="${min}" max="${max}" step="1">`;
const selectInput = (path,choices,val) => `<select data-field="${h(path)}">${options(choices,val)}</select>`;
const button = (act,text,extra="") => `<button type="button" data-act="${h(act)}" ${extra}>${text}</button>`;

export class BrazierApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:"brazier-app", classes:["brazier-window"],
    position:{width:1160,height:750},
    window:{title:"Brazier", icon:"fa-solid fa-fire-flame-curved", resizable:true, minimizable:true}
  };
  // Keep the template wrapper: delegated controls and layout bind to .brazier-root.
  static PARTS = {body:{template:"modules/brazier/templates/window.hbs"}};

  constructor(options={}) {
    super(options);
    this.tab="trees"; this.treeId=null; this.nodeId=null;
    this.editing=false; this.railCollapsed=false; this.panel=null;
    this.zoom=1; this.pan={x:0,y:0}; this.linkSource=null; this.linking=false;
    this.previewUserId=null; this._busy=false; this._suppressClickUntil=0;
  }
  get effectiveUser(){return viewingAs(this);}
  get isStoryteller(){return storyteller(this);}
  get trees(){return availableTrees(this.effectiveUser);}
  get tree(){return this.trees.find(t=>t.id===this.treeId) ?? null;}
  get viewingUser(){
    if (!this.isStoryteller) return this.effectiveUser.id;
    return game.users.get(this.previewUserId)?.id ?? game.users.find(u=>!u.isGM && (this.tree?.access==="all" || this.tree?.users?.includes(u.id)))?.id ?? game.user.id;
  }
  get progress(){
    const t=this.tree;
    return t?.progress ?? (t?progressFor(t,this.viewingUser):{points:0,ranks:{}});
  }
  async _prepareContext(options){
    const context=await super._prepareContext(options);
    const trees=this.trees;
    if (!trees.some(t=>t.id===this.treeId)) {this.treeId=trees[0]?.id??null;this.nodeId=null;this.panel=null;}
    const t=this.tree;
    return {...context,
      gm:this.isStoryteller, canViewAs:game.user.isGM, viewAsActive:!this.isStoryteller&&game.user.isGM, viewAsName:this.effectiveUser.name, viewAsPlayers:game.users.filter(u=>!u.isGM).map(u=>({id:u.id,name:u.name,selected:u.id===this.viewAsUserId})), trees:trees.map(item=>({id:item.id,name:item.name,active:item.id===this.treeId})),
      treesTab:this.tab==="trees",boonsTab:this.tab==="boons",curioTab:this.tab==="curio",caravanTab:this.tab==="caravan",
      railCollapsed:this.railCollapsed,hasTree:!!t, editing:this.isStoryteller&&this.editing,
      currentName:t?.name, currentDescription:t?.description, pointCount:this.progress.points??0,
      pointIconClass:ICONS[t?.pointIcon] || ICONS.star,
      currency:t?.currency,background:t?.background||"plain",
      placeholderTitle:{boons:"Benison Boons",curio:"Curio",caravan:"Caravan"}[this.tab]
      ,catalogContent:["curio","boons"].includes(this.tab)?catalogHTML(this):"",catalogTab:["curio","boons"].includes(this.tab)
    };
  }
  async _onRender(context,options){
    await super._onRender(context,options);
    const root=this.element?.querySelector(".brazier-root");
    if(!root)return;
    // A persistent Application part may be rendered more than once with the same root.
    // Register delegated listeners only once per concrete DOM element.
    if (!root.dataset.brazierBound) {
      root.dataset.brazierBound="1";
      root.addEventListener("click",e=>this._onClick(e));
      root.addEventListener("change",e=>this._onChange(e).catch(err=>this._warn(err)));
      root.addEventListener("input",e=>{
        if(e.target.dataset.catField)catalogChange(this,e).catch(err=>this._warn(err));
      });
      root.addEventListener("keydown",e=>{
        if (e.key === "Escape" && this.linking) {this.linking=false;this.linkSource=null;this._renderGraph();}
      });
    }
    if(this.tab==="trees" && this.tree){this._renderGraph();this._bindCanvas();}
  }
  async _refresh(){if(this.rendered) await this.render();}
  _warn(err){console.error("Brazier",err);ui.notifications.error(`Brazier: ${err.message??err}`);}
  async _commit(modifier){
    if(!this.isStoryteller || this._busy)return;
    const tree=this.tree;
    if(!tree)return;
    const copy=clone(tree);delete copy._docId;
    try {modifier(copy);validateTree(copy);this._busy=true;await saveTree(copy);}
    catch(err){this._warn(err);}
    finally{this._busy=false;await this._refresh();}
  }
  async _onClick(event){
    if(event.target.closest("[data-cat-act]")?.dataset.catAct){
      try{await catalogClick(this,event);}catch(error){this._warn(error);await this._refresh();}
      return;
    }
    const el=event.target.closest("[data-act]");if(!el)return;
    const act=el.dataset.act;const val=el.dataset.value;
    try {
      switch(act){
        case "return-storyteller":setPerspective(this,"");await this._refresh();break;
        case "tab":this.tab=val;this.panel=null;await this._refresh();break;
        case "rail":this.railCollapsed=!this.railCollapsed;await this._refresh();break;
        case "choose-tree":this.treeId=val;this.nodeId=null;this.pan={x:0,y:0};this.zoom=1;this.panel=null;this.linking=false;await this._refresh();break;
        case "new-tree":{
          if(!this.isStoryteller)return;
          const doc=await makeTree(`New Skill Tree ${this.trees.length+1}`);
          this.treeId=doc.getFlag("brazier","data").tree.id;
          this.editing=true;this.panel="settings";await this._refresh();break;
        }
        case "edit-toggle":if(!this.isStoryteller)return;this.editing=!this.editing;this.panel=null;this.linking=false;this.linkSource=null;await this._refresh();break;
        case "add-node":await this._commit(t=>{const n=freshNode("New Talent",Math.round(-this.pan.x/this.zoom),Math.round(-this.pan.y/this.zoom));t.nodes.push(n);this.nodeId=n.id;this.panel="node";});break;
        case "link-mode":this.linking=!this.linking;this.linkSource=null;this.panel=null;this._renderGraph();break;
        case "tree-settings":this.panel="settings";this.nodeId=null;this._renderGraph();break;
        case "close-panel":this.panel=null;this.nodeId=null;this._renderGraph();break;
        case "fit":this.zoom=1;this.pan={x:0,y:0};this._transformWorld();break;
        case "zoomin":this._zoomBy(1.2);break;
        case "zoomout":this._zoomBy(1/1.2);break;
        case "select-node":await this._selectNode(val);break;
        case "unlock":{
          const tree=this.tree;const node=tree?.nodes.find(n=>n.id===this.nodeId);if(!node)return;
          if(!window.confirm(`Spend ${node.cost} ${tree.currency} to unlock ${node.name}?`))return;
          if(game.user.isGM) {
            const recipient=!this.isStoryteller?this.effectiveUser.id:this.progressRecipient();
            await spendPoint(tree.id,node.id,recipient);
          } else await requestPurchase(tree.id,node.id);
          if(!game.user.isGM) ui.notifications.info("Upgrade requested. The Storyteller client processes valid requests when online.");
          await this._refresh(); break;
        }
        case "delete-node":{
          if(!window.confirm("Delete this talent and all links to it?"))return;
          const id=this.nodeId;
          await this._commit(t=>{t.nodes=t.nodes.filter(n=>n.id!==id);t.nodes.forEach(n=>n.requires=n.requires.filter(r=>r!==id));delete t.shared.ranks[id];Object.values(t.personal).forEach(p=>delete p.ranks[id]);this.nodeId=null;this.panel=null;});break;
        }
        case "delete-tree":{
          if(!this.isStoryteller||!window.confirm(`Permanently delete '${this.tree?.name}' and its progression?`))return;
          await deleteTree(this.treeId);this.treeId=null;this.panel=null;await this._refresh();break;
        }
        case "browse-background":await this._browseImage("tree.backgroundUrl");break;
        case "browse-node":await this._browseImage("node.iconUrl");break;
        case "export":this._export();break;
        case "import":this.element.querySelector("#brazier-import")?.click();break;
        case "points-plus":await this._changePoints(1);break;
        case "points-minus":await this._changePoints(-1);break;
        case "help":ui.notifications.info("Drag empty space to pan; scroll to zoom. Editor: drag talents and use Connect to set prerequisites.");break;
      }
    } catch(err){this._warn(err);}
  }
  progressRecipient(){return this.tree.progression==="personal" ? this.viewingUser : (game.users.find(u=>!u.isGM && (this.tree.access==="all" || this.tree.users.includes(u.id)))?.id ?? game.user.id);}
  async _changePoints(delta){
    if(!this.isStoryteller)return;
    const userId=this.viewingUser;
    await this._commit(t=>{
      const p=t.progression==="shared"?t.shared:(t.personal[userId]??={points:0,ranks:{}});
      p.points=Math.max(0,p.points+delta);
    });
  }
  async _selectNode(id){
    if(this.linking&&this.editing){
      if(!this.linkSource){this.linkSource=id;this._renderGraph();return;}
      const source=this.linkSource;this.linkSource=null;this.linking=false;
      if(source===id){this._renderGraph();return;}
      await this._commit(t=>{
        const n=t.nodes.find(n=>n.id===id);
        if(!n) return;
        if(n.requires.includes(source))n.requires=n.requires.filter(r=>r!==source);
        else n.requires.push(source);
      });return;
    }
    this.nodeId=id;this.panel="node";this._renderGraph();
  }
  async _onChange(e){
    if(e.target.hasAttribute?.("data-view-as")){setPerspective(this,e.target.value);await this._refresh();return;}
    if(await catalogChange(this,e))return;
    if(e.target.id==="brazier-import"&&e.target.files?.length) {try {await this._import(e.target.files[0]);} finally {e.target.value="";}return;}
    const field=e.target.dataset.field;if(!field||!this.isStoryteller)return;
    const val=e.target.type==="checkbox"?e.target.checked:e.target.value;
    if(field==="preview"){this.previewUserId=val;await this._refresh();return;}
    const targetId=this.nodeId;
    const userId=this.viewingUser;
    await this._commit(t=>{
      if(field==="tree.users"){
        const id=e.target.dataset.user;
        t.users=val?[...new Set([...t.users,id])]:t.users.filter(u=>u!==id);
      } else if(field.startsWith("tree.")){
        const key=field.slice(5);
        t[key] = ["glow"].includes(key)?Number(val):val;
      } else if(field==="points"){
        const p=t.progression==="shared"?t.shared:(t.personal[userId]??={points:0,ranks:{}});
        p.points=Math.max(0,Number(val)||0);
      } else if(field==="node.requires"){
        const n=t.nodes.find(n=>n.id===targetId);if(!n)return;
        n.requires=val?[...new Set([...n.requires,e.target.dataset.prereq])]:n.requires.filter(i=>i!==e.target.dataset.prereq);
      } else if(field.startsWith("node.")){
        const n=t.nodes.find(n=>n.id===targetId);if(!n)return;
        const key=field.slice(5);
        n[key]=["cost","maxRank"].includes(key)?Math.max(key==="maxRank"?1:0,Math.round(Number(val)||0)):val;
      }
      if(t.background!=="custom")t.backgroundUrl="";
    });
  }
  async _browseImage(path){
    if(!this.isStoryteller)return;
    const Picker=foundry.applications.apps.FilePicker;
    const picker=new Picker({type:"image",callback:async selected=>{
      if(!safeAsset(selected))return;
      await this._commit(t=>{
        if(path==="tree.backgroundUrl"){t.background="custom";t.backgroundUrl=selected;}
        else{const node=t.nodes.find(n=>n.id===this.nodeId);if(node)node.iconUrl=selected;}
      });
    }});
    await picker.render({force:true});
  }
  _zoomBy(factor,pointer){
    const stage=this.element?.querySelector(".brazier-stage");if(!stage)return;
    const rect=stage.getBoundingClientRect();
    const anchor=pointer?{x:pointer.clientX-rect.left-rect.width/2,y:pointer.clientY-rect.top-rect.height/2}:{x:0,y:0};
    const old=this.zoom, next=Math.min(2.5,Math.max(.35,old*factor));
    this.pan.x=anchor.x-(anchor.x-this.pan.x)*next/old;
    this.pan.y=anchor.y-(anchor.y-this.pan.y)*next/old;
    this.zoom=next;this._transformWorld();
  }
  _transformWorld(){
    const stage=this.element?.querySelector(".brazier-stage");const world=stage?.querySelector(".brazier-world");if(!world)return;
    world.style.transform=`translate(${stage.clientWidth/2+this.pan.x}px, ${stage.clientHeight/2+this.pan.y}px) scale(${this.zoom})`;
    const zoom=stage.querySelector(".brazier-zoomvalue");if(zoom)zoom.textContent=`${Math.round(this.zoom*100)}%`;
  }
  _bindCanvas(){
    const stage=this.element.querySelector(".brazier-stage");if(!stage||stage.dataset.brazierCanvasBound)return;
    stage.dataset.brazierCanvasBound="1";
    stage.addEventListener("wheel",e=>{if(e.target.closest(".brazier-overlay"))return;e.preventDefault();this._zoomBy(e.deltaY<0?1.1:1/1.1,e);},{passive:false});
    let interaction=null;
    stage.addEventListener("click",e=>{if(Date.now()<this._suppressClickUntil && e.target.closest(".brazier-node")){e.preventDefault();e.stopPropagation();}},true);
    stage.addEventListener("pointerdown",e=>{
      if(e.button!==0||e.target.closest(".brazier-overlay, .brazier-zoom"))return;
      const node=e.target.closest(".brazier-node");
      if(node&&this.editing&&!this.linking){
        interaction={type:"node",id:node.dataset.id,x:e.clientX,y:e.clientY,moved:false,origX:Number(node.dataset.x),origY:Number(node.dataset.y)};
      } else if(!node){interaction={type:"pan",x:e.clientX,y:e.clientY,origX:this.pan.x,origY:this.pan.y};}
      if(interaction){stage.setPointerCapture(e.pointerId);}
    });
    stage.addEventListener("pointermove",e=>{
      if(!interaction)return;
      const dx=e.clientX-interaction.x,dy=e.clientY-interaction.y;
      if(interaction.type==="pan"){
        this.pan.x=interaction.origX+dx;this.pan.y=interaction.origY+dy;this._transformWorld();
      } else {
        interaction.moved=interaction.moved||Math.abs(dx)+Math.abs(dy)>5;
        if(!interaction.moved)return;
        const el=[...stage.querySelectorAll(".brazier-node")].find(n=>n.dataset.id===interaction.id);
        if(el){el.style.left=`${interaction.origX+dx/this.zoom}px`;el.style.top=`${interaction.origY+dy/this.zoom}px`;}
      }
    });
    stage.addEventListener("pointerup",async e=>{
      if(!interaction)return;
      const i=interaction;interaction=null;
      try{stage.releasePointerCapture(e.pointerId);}catch{}
      // Pointer capture may retarget the following click to the stage. Select once on
      // pointerup, then suppress any duplicate native click on the button.
      if(i.type==="node"&&!i.moved){this._suppressClickUntil=Date.now()+200;await this._selectNode(i.id);return;}
      if(i.type==="node"&&i.moved) {
        this._suppressClickUntil=Date.now()+200;
        const x=Math.max(-2300,Math.min(2300,Math.round(i.origX+(e.clientX-i.x)/this.zoom)));
        const y=Math.max(-2300,Math.min(2300,Math.round(i.origY+(e.clientY-i.y)/this.zoom)));
        await this._commit(t=>{const n=t.nodes.find(n=>n.id===i.id);if(n){n.x=x;n.y=y;}});
      }
    });
    stage.addEventListener("pointercancel",()=>{interaction=null;});
  }
  _renderGraph(){
    const t=this.tree; const stage=this.element?.querySelector(".brazier-stage");if(!t||!stage)return;
    stage.dataset.bg=t.background;
    stage.style.setProperty("--brazier-custom-bg",t.background==="custom"&&safeAsset(t.backgroundUrl)?`url("${safeAsset(t.backgroundUrl)}")`:"none");
    stage.style.setProperty("--brazier-line-color",okColor(t.lineColor));
    const progress=this.progress;const nodes=stage.querySelector(".brazier-nodes");const edges=stage.querySelector(".brazier-edges");
    const byId=new Map(t.nodes.map(n=>[n.id,n]));
    edges.replaceChildren();nodes.replaceChildren();
    const color=okColor(t.lineColor);
    for(const target of t.nodes){
      for(const reqId of target.requires){
        const source=byId.get(reqId);if(!source)continue;
        const dx=target.x-source.x,dy=target.y-source.y;
        const d=(t.line==="minimal"||t.line==="chain")?`M ${source.x} ${source.y} L ${target.x} ${target.y}`:
          `M ${source.x} ${source.y} C ${source.x+dx*.48} ${source.y-dy*.24}, ${target.x-dx*.48} ${target.y+dy*.24}, ${target.x} ${target.y}`;
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d",d);path.setAttribute("stroke",color);
        path.setAttribute("class",`brazier-path line-${t.line} ${rankOf(progress,target.id)?"unlocked":""}`);
        if (rankOf(progress,target.id) > 0 && Number(t.glow) > 0) path.style.filter=`drop-shadow(0 0 ${Math.min(8,Number(t.glow)/4)}px ${color})`;
        edges.appendChild(path);
      }
    }
    for(const node of t.nodes){
      const rank=rankOf(progress,node.id);
      const available=canBuy(t,node,progress);
      const reachable=node.requires.every(id=>rankOf(progress,id)>0);
      const state=rank?"unlocked":available?"available":reachable?"frontier":"locked";
      const btn=document.createElement("button");btn.type="button";
      btn.className=`brazier-node ${state} ${this.nodeId===node.id?"selected":""} ${this.linkSource===node.id?"link-source":""}`;
      btn.dataset.act="select-node";btn.dataset.value=node.id;btn.dataset.id=node.id;
      btn.dataset.x=node.x;btn.dataset.y=node.y;
      btn.style.left=`${node.x}px`;btn.style.top=`${node.y}px`;
      btn.title=node.name+(rank?` • Rank ${rank}/${node.maxRank}`:"");
      btn.innerHTML=`<span class="brazier-node-symbol">${iconHtml(node.icon,node.iconUrl)}</span><span class="brazier-node-caption">${h(node.name)}</span>${node.maxRank>1?`<small class="brazier-rank">${rank}/${node.maxRank}</small>`:""}`;
      nodes.appendChild(btn);
    }
    this._transformWorld();this._renderOverlay();
  }
  _renderOverlay(){
    const t=this.tree, overlay=this.element?.querySelector(".brazier-overlay");if(!t||!overlay)return;
    overlay.replaceChildren();
    if(this.linking&&this.editing){
      const tip=document.createElement("div");tip.className="brazier-link-tip";
      tip.textContent=this.linkSource?"Select a dependent talent to link or unlink. Escape cancels.":"Choose the prerequisite talent, then the dependent talent.";
      overlay.appendChild(tip);
    }
    if(!this.panel)return;
    const card=document.createElement("div");card.className="brazier-inspector";
    if(this.panel==="node"){
      const node=t.nodes.find(n=>n.id===this.nodeId);if(!node){this.panel=null;return;}
      card.innerHTML=this.isStoryteller&&this.editing?this._editNodeHtml(t,node):this._viewNodeHtml(t,node);
    } else if(this.panel==="settings"&&this.editing) card.innerHTML=this._settingsHtml(t);
    else return;
    overlay.appendChild(card);
  }
  _viewNodeHtml(t,node){
    const progress=this.progress,rank=rankOf(progress,node.id), available=canBuy(t,node,progress);
    const req=node.requires.map(id=>t.nodes.find(n=>n.id===id)?.name).filter(Boolean);
    return `<div class="brazier-inspector-title"><span>Talent Details</span>${button("close-panel",'<i class="fa-solid fa-xmark"></i>')}</div>
      <div class="brazier-talent-emblem">${iconHtml(node.icon,node.iconUrl)}</div>
      <h2>${h(node.name)}</h2><p>${h(node.description||"No description yet.")}</p>
      <dl><dt>Cost</dt><dd>${node.cost} ${h(t.currency)}</dd><dt>Rank</dt><dd>${rank} / ${node.maxRank}</dd></dl>
      ${req.length?`<div class="brazier-requisites"><b>Prerequisites</b>${req.map(n=>`<span><i class="fa-solid fa-link"></i> ${h(n)}</span>`).join("")}</div>`:""}
      ${rank>=node.maxRank?'<div class="brazier-owned">Fully unlocked</div>':
        button("unlock", this.isStoryteller?"Unlock Talent":"Spend Points",available?"class='brazier-primary'":"disabled title='Need points or prerequisites'")}
      ${!game.user.isGM?'<small class="brazier-note">A Storyteller client validates and applies purchases.</small>':""}`;
  }
  _editNodeHtml(t,node){
    return `<div class="brazier-inspector-title"><span>Talent Properties</span>${button("close-panel",'<i class="fa-solid fa-xmark"></i>')}</div>
      ${formRow("Name",textInput("node.name",node.name))}
      ${formRow("Description",`<textarea data-field="node.description" rows="3">${h(node.description)}</textarea>`)}
      <div class="brazier-two">${formRow("Point Cost",numInput("node.cost",node.cost,0,999))}${formRow("Ranks",numInput("node.maxRank",node.maxRank,1,50))}</div>
      ${formRow("Icon",selectInput("node.icon",Object.keys(ICONS),node.icon))}
      ${formRow("Custom Icon",textInput("node.iconUrl",node.iconUrl||"","Path or URL"))}
      ${button("browse-node",'<i class="fa-solid fa-folder-open"></i> Browse Image')}
      <div class="brazier-requisites"><b>Prerequisites</b>${t.nodes.filter(n=>n.id!==node.id).map(n=>`<label class="brazier-checkbox"><input type="checkbox" data-field="node.requires" data-prereq="${h(n.id)}" ${node.requires.includes(n.id)?"checked":""}>${h(n.name)}</label>`).join("")||'<small>None — a root talent</small>'}</div>
      ${button("delete-node",'<i class="fa-solid fa-trash"></i> Delete Talent',"class='brazier-danger'")}`;
  }
  _settingsHtml(t){
    const otherUsers=game.users.filter(u=>!u.isGM);
    return `<div class="brazier-inspector-title"><span>Tree Settings</span>${button("close-panel",'<i class="fa-solid fa-xmark"></i>')}</div>
      ${formRow("Tree Name",textInput("tree.name",t.name))}
      ${formRow("Description",`<textarea data-field="tree.description" rows="2">${h(t.description)}</textarea>`)}
      ${formRow("Access",selectInput("tree.access",["all","selected","gm"],t.access))}
      ${t.access==="selected"?`<div class="brazier-assignments"><b>Assigned Players</b>${otherUsers.map(u=>`<label class="brazier-checkbox"><input type="checkbox" data-field="tree.users" data-user="${h(u.id)}" ${t.users.includes(u.id)?"checked":""}>${h(u.name)}</label>`).join("")||'<small>No player accounts found.</small>'}</div>`:""}
      ${formRow("Fog of War",selectInput("tree.visibility",VISIBILITIES,t.visibility))}
      ${formRow("Progression",selectInput("tree.progression",["shared","personal"],t.progression))}
      ${t.progression==="personal"?formRow("Inspect Player",`<select data-field="preview">${otherUsers.map(u=>`<option value="${h(u.id)}" ${u.id===this.viewingUser?"selected":""}>${h(u.name)}</option>`).join("")}</select>`):""}
      ${formRow("Available Points",`<div class="brazier-points-row">${button("points-minus","−")} ${numInput("points",this.progress.points??0,0,999999)} ${button("points-plus","+")}</div>`)}
      ${formRow("Currency Name",textInput("tree.currency",t.currency))}
      ${formRow("Point Icon",selectInput("tree.pointIcon",Object.keys(ICONS),t.pointIcon))}
      ${formRow("Background",selectInput("tree.background",BACKGROUNDS,t.background))}
      ${t.background==="custom"?formRow("Background Path",textInput("tree.backgroundUrl",t.backgroundUrl||"")):""}
      ${button("browse-background",'<i class="fa-solid fa-folder-open"></i> Choose / Upload Background')}
      ${formRow("Connection",selectInput("tree.line",LINES,t.line))}
      ${formRow("Line Color",`<input type="color" data-field="tree.lineColor" value="${okColor(t.lineColor)}">`)}
      ${formRow("Glow (0–35)",`<input type="range" data-field="tree.glow" value="${Math.min(35,Number(t.glow)||0)}" min="0" max="35">`)}
      ${button("delete-tree",'<i class="fa-solid fa-trash"></i> Delete Entire Tree',"class='brazier-danger'")}`;
  }
  _export(){
    if(!this.isStoryteller||!this.tree)return;
    const tree=clone(this.tree);delete tree._docId;
    const file=new Blob([JSON.stringify({format:"brazier-tree",version:1,tree},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=`brazier-${tree.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async _import(file){
    if(!this.isStoryteller)return;
    if(file.size > 2_000_000) throw new Error("Tree export exceeds the 2 MB import limit.");
    const data=JSON.parse(await file.text());if(data.format!=="brazier-tree" || data.version!==1)throw new Error("Not a supported Brazier tree export.");
    const tree=clone(data.tree);tree.id=uid();tree.shared={points:0,ranks:{}};tree.personal={};tree.requestIds=[];
    // A template from another world has a different optimistic-concurrency revision.
    tree.updatedAt=Date.now();
    validateTree(tree);
    const doc=await makeTree(tree.name);
    const master=doc.getFlag("brazier","data").tree;
    tree.id=master.id;
    tree.updatedAt=master.updatedAt;
    // On a failed save, do not leave a starter tree with a misleading imported name.
    try {await saveTree(tree);}
    catch(error) {try {await doc.delete();}catch(cleanupError){console.error("Brazier: failed import cleanup",cleanupError);}throw error;}
    this.treeId=tree.id;this.editing=true;await this._refresh();
  }
}
