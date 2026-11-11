/** Run ONLY inside the disposable brazier-dev PF2E world. Uses real Foundry APIs. */
export async function runNativeSuite(){
  if(!game.ready||game.world.id!=="brazier-dev"||!game.user.isGM||game.system.id!=="pf2e")throw Error("Native tests require GM in the isolated brazier-dev PF2E world.");
  if(!game.modules.get("brazier")?.active||!game.modules.get("pf2e-dailies")?.active)throw Error("Enable Brazier and PF2e Dailies first.");
  const {BrazierApplication}=await import("/modules/brazier/scripts/app.mjs");
  const store=await import("/modules/brazier/scripts/store.mjs");
  const catalog=await import("/modules/brazier/scripts/catalog.mjs");
  const {benisonItems,prepareBenison}=await import("/modules/brazier/scripts/benison-dailies.mjs");
  const results=[],created=[],originalBoons=catalog.boonCatalog();
  let app,actor,user,tree;
  const check=(name,pass,details="")=>{results.push({name,passed:Boolean(pass),details});if(!pass)throw Error(name+": "+details);};
  const until=async(test)=>{const end=Date.now()+15000;while(Date.now()<end){if(await test())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error("Timed out waiting for native UI/document update");};
  const click=async(selector)=>{const el=app.element.querySelector(selector);if(!el)throw Error("Missing control "+selector);el.click();await new Promise(resolve=>setTimeout(resolve,100));};
  const report={runtime:"native-foundry",started:new Date().toISOString(),versions:{foundry:game.version??game.release.version,system:game.system.version,brazier:game.modules.get("brazier").version,dailies:game.modules.get("pf2e-dailies").version},results};
  try{
    actor=await Actor.create({name:"Brazier QA Character",type:"character",system:{details:{level:{value:15}}},flags:{brazierDev:{fixture:true}}});created.push(actor);
    user=await User.create({name:"Brazier QA Player",role:CONST.USER_ROLES.PLAYER,character:actor.id,flags:{brazierDev:{fixture:true}}});created.push(user);
    await actor.update({[`ownership.${user.id}`]:CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER});
    check("Real PF2E actor and assigned User schemas",user.character?.id===actor.id&&actor.level===15);
    const master=await store.makeTree("Brazier Native QA Tree");tree=structuredClone(master.getFlag("brazier","data").tree);
    tree.users=[user.id];await store.saveTree(tree);
    app=new BrazierApplication();await app.render({force:true});
    check("Native ApplicationV2 render",app instanceof foundry.applications.api.ApplicationV2&&app.element.querySelector(".brazier-root"));
    for(const section of ["boons","curio","caravan","trees"]){await click(`[data-act="tab"][data-value="${section}"]`);await until(()=>app.tab===section);check("Section tab: "+section,true);}
    app.treeId=tree.id;app.editing=true;await app.render({force:true});const count=app.tree.nodes.length;
    await click('[data-act="add-node"]');await until(()=>app.tree.nodes.length===count+1);
    check("Real JournalEntry persistence after Add Talent",store.masterById(tree.id).getFlag("brazier","data").tree.nodes.length===count+1);
    const pack=game.packs.get("pf2e.equipment-srd");if(!pack)throw Error("PF2E equipment pack is unavailable.");
    const index=await pack.getIndex({fields:["type","system.level.value","system.traits.value"]});
    const choices=[14,11,10].map(level=>index.find(i=>["consumable","weapon","ammo"].includes(i.type)&&i.system.level.value===level&&i.system.traits.value.includes("consumable")));
    check("Real compendium sources for each quantity tier",choices.every(Boolean));
    let b=catalog.boonCatalog();b.consumables=[];b.consumableCount=2;b.quantityBands={highMinimum:-1,middleMinimum:-4,highQuantity:1,middleQuantity:2,lowQuantity:3};await catalog.saveBoons(b);
    for(const source of choices)await catalog.addConsumable(`Compendium.${pack.collection}.Item.${source._id}`);
    app.tab="boons";app.boonSection="consumables";app.viewAsUserId=user.id;await app.render({force:true});
    const boxes=()=>[...app.element.querySelectorAll('[data-cat-field="choice.consumables"]')];
    check("Assigned player can choose",boxes().length===3&&boxes().every(box=>!box.disabled));
    boxes()[0].click();await until(()=>boxes()[0].checked);boxes()[1].click();await until(()=>boxes()[2].disabled);
    check("Checkbox cap",boxes()[2].disabled);
    check("Amount columns use actual actor level",[...app.element.querySelectorAll(".brazier-amount")].map(e=>e.textContent).join(",")==="1,2,—");
    boxes()[1].click();await until(()=>!boxes()[2].disabled);check("Unchecking re-enables choices",!boxes()[2].disabled);
    boxes()[2].click();await until(()=>boxes()[2].checked);await click('[data-cat-act="save-choices"]');
    await until(()=>catalog.boonChoices(user).consumables.length===2);check("Selections persisted for selected player",true);
    app.viewAsUserId=null;await app.close();app=null;
    await game.dailies.api.openDailiesInterface(actor);
    const dailyRoot=()=>document.getElementById(`pf2e-dailies-interface-${actor.uuid}`);
    await until(()=>dailyRoot()?.querySelector('[data-action="accept"]'));
    const rows=[...dailyRoot().querySelectorAll('.notify input')].map(el=>el.value);
    check("Native Dailies renders separate plain-text consumable rows",rows.length===2&&rows.every(text=>!text.includes("<br>")));
    dailyRoot().querySelector('[data-action="accept"]').click();await until(()=>actor.getFlag("brazier","benisonState")?.prepared&&!game.dailies.api.canPrepareDailies(actor));
    check("Actual Dailies Accept creates temporary inventory",benisonItems(actor).length===2&&benisonItems(actor).every(i=>i.system.temporary));
    check("Actual embedded item quantities",benisonItems(actor).map(i=>i.system.quantity).sort().join(",")==="1,3");
    await prepareBenison(actor);check("Repeated preparation does not duplicate stacks",benisonItems(actor).length===2);
    await game.pf2e.actions.restForTheNight({actors:[actor],skipDialog:true});
    check("Real PF2E rest plus Dailies cleans inventory",benisonItems(actor).length===0&&!actor.getFlag("brazier","benisonState")?.prepared);
    report.passed=true;
  }catch(error){report.passed=false;report.error=error.stack??String(error);console.error("Brazier native tests",error);}
  finally{
    if(app)await app.close();
    // All mutations are confined to this disposable world; restore the curated catalog.
    try{await catalog.saveBoons({...originalBoons,updatedAt:catalog.boonCatalog().updatedAt});if(tree)await store.deleteTree(tree.id);if(user)for(const doc of game.journal.filter(d=>d.getFlag("brazier","catalog")?.kind==="boon-choice"&&d.getFlag("brazier","catalog").userId===user.id))await doc.delete();for(const doc of created.reverse())await doc.delete();}
    catch(error){report.passed=false;report.cleanupError=String(error);}
  }
  report.finished=new Date().toISOString();
  const text=JSON.stringify(report,null,2);
  const escaped=text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const journal=await JournalEntry.create({name:`Brazier Native QA — ${report.passed?"PASS":"FAIL"}`,ownership:{default:0},flags:{brazierDev:{report:true}},pages:[{name:"Test results",type:"text",text:{format:1,content:`<pre>${escaped}</pre>`}}]});
  journal.sheet.render(true);
  ui.notifications[report.passed?"info":"error"](`Brazier native QA: ${report.passed?"PASSED":"FAILED"}. See the test report Journal Entry.`);
  return report;
}
