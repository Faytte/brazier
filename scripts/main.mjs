import {BrazierApplication} from "./app.mjs";
import {receiveRequest,processPendingRequests,refreshAll} from "./store.mjs";
import {refreshCatalog} from "./catalog.mjs";

let app;
function openBrazier(){
  app ??= new BrazierApplication();
  return app.render({force:true}).catch(err=>{console.error("Brazier",err);ui.notifications.error(`Brazier: ${err.message}`);});
}
// Foundry owns rendering, placement, accessibility and lifecycle of the tool.
Hooks.on("getSceneControlButtons",controls=>{
  const tokens=controls.tokens;
  if(!tokens?.tools)return;
  tokens.tools.brazier={
    name:"brazier",title:"Brazier Flame Management (Alt+B)",
    icon:"fa-solid fa-fire-flame-curved",
    order:Object.keys(tokens.tools).filter(name=>name!=="brazier").length,
    button:true,visible:true,onChange:()=>openBrazier()
  };
});
Hooks.once("init",()=>{
  game.keybindings.register("brazier","open",{
    name:"Open Brazier",hint:"Open the Brazier skill-tree window.",
    editable:[{key:"KeyB",modifiers:["ALT"]}],
    onDown:()=>{openBrazier();return true;},restricted:false
  });
  game.modules.get("brazier").api={open:openBrazier};
});
Hooks.once("ready",async()=>{
  Hooks.on("updateJournalEntry",(doc)=>{
    if((doc.getFlag("brazier","data")||doc.getFlag("brazier","catalog")) && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("createJournalEntry",(doc)=>{
    if((doc.getFlag("brazier","data")||doc.getFlag("brazier","catalog")) && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("deleteJournalEntry",(doc)=>{
    if((doc.getFlag("brazier","data")||doc.getFlag("brazier","catalog")) && app?.rendered) app.render().catch(console.error);
  });
  Hooks.on("createChatMessage",message=>{
    if(message.getFlag("brazier","request")) receiveRequest(message).catch(console.error);
  });
  if(game.user.isGM){
    try {await refreshAll();await processPendingRequests();
      const primary=game.users.filter(u=>u.isGM&&u.active).sort((a,b)=>a.id.localeCompare(b.id))[0];
      if(primary?.id===game.user.id)await refreshCatalog();
    }
    catch(error){console.error("Brazier: initial projection sync failed",error);}
  }
});
