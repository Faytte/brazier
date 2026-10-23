import {BrazierApplication} from "./app.mjs";
import {receiveRequest,processPendingRequests,refreshAll} from "./store.mjs";

let app;
function openBrazier(){
  app ??= new BrazierApplication();
  app.render({force:true}).catch(err=>{console.error("Brazier",err);ui.notifications.error(`Brazier: ${err.message}`);});
}
function mountLauncher(){
  // Prefer the native sidebar navigation strip; use an unobtrusive fixed launcher if the current skin moves it.
  const anchor=document.querySelector("#sidebar-tabs") || document.querySelector("#sidebar .tabs") ||
    document.querySelector(".sidebar-tabs") || document.querySelector("[data-application-part='tabs']#sidebar-tabs");
  let btn=document.getElementById("brazier-launcher");
  if (!btn) {
    btn=document.createElement("button");btn.type="button";btn.id="brazier-launcher";
    btn.className="brazier-launcher";btn.title="Open Brazier (Alt+B)";
    btn.setAttribute("aria-label","Open Brazier");
    btn.innerHTML='<i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>';
    btn.addEventListener("click",openBrazier);
  }
  // Sidebar skins frequently render or replace their navigation after ready.
  if(anchor) {if(btn.parentNode!==anchor)anchor.appendChild(btn);btn.classList.add("in-sidebar");}
  else {if(btn.parentNode!==document.body)document.body.appendChild(btn);btn.classList.remove("in-sidebar");}
}
Hooks.once("init",()=>{
  game.keybindings.register("brazier","open",{
    name:"Open Brazier",hint:"Open the Brazier skill-tree window.",
    editable:[{key:"KeyB",modifiers:["ALT"]}],
    onDown:()=>{openBrazier();return true;},restricted:false
  });
  game.modules.get("brazier").api={open:openBrazier};
});
Hooks.once("ready",async()=>{
  mountLauncher();
  // Theme and core versions may rerender the sidebar; reinsert after relevant core renders.
  Hooks.on("renderSidebar",()=>queueMicrotask(mountLauncher));
  Hooks.on("renderSidebarTab",()=>queueMicrotask(mountLauncher));
  Hooks.on("renderSidebarV2",()=>queueMicrotask(mountLauncher));
  Hooks.on("updateJournalEntry",(doc)=>{
    if(doc.getFlag("brazier","data") && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("createJournalEntry",(doc)=>{
    if(doc.getFlag("brazier","data") && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("deleteJournalEntry",(doc)=>{
    if(doc.getFlag("brazier","data") && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("createChatMessage",message=>{
    if(message.getFlag("brazier","request")) receiveRequest(message).catch(console.error);
  });
  if(game.user.isGM){
    try {await refreshAll();await processPendingRequests();}
    catch(error){console.error("Brazier: initial projection sync failed",error);}
  }
});
