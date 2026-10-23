import {BrazierApplication} from "./app.mjs";
import {receiveRequest,processPendingRequests,refreshAll} from "./store.mjs";

let app;
function openBrazier(){
  app ??= new BrazierApplication();
  app.render({force:true}).catch(err=>{console.error("Brazier",err);ui.notifications.error(`Brazier: ${err.message}`);});
}
function mountLauncher(){
  // Stay outside sidebar containers, which core layouts and themes may hide or replace.
  let btn=document.getElementById("brazier-launcher");
  if (!btn) {
    btn=document.createElement("button");btn.type="button";btn.id="brazier-launcher";
    btn.className="brazier-launcher";btn.title="Open Brazier (Alt+B)";
    btn.setAttribute("aria-label","Open Brazier");
    btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13 2c1 5-4 6-2 10 1-1 2-2 2-4 4 3 6 6 6 9a7 7 0 0 1-14 0c0-4 3-6 4-9-1 5 0 5 1 6-1-5 5-7 3-12Z"/></svg>';
    btn.addEventListener("click",openBrazier);
  }
  if(btn.parentNode!==document.body)document.body.appendChild(btn);
  btn.classList.remove("in-sidebar");
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
