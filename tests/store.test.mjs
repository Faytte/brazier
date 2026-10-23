import assert from 'node:assert/strict';
import {clone,freshNode} from '../scripts/model.mjs';
const allDocs=[]; const allMessages=[]; let sequence=0;
const users=[
  {id:'gm',name:'Storyteller',isGM:true,active:true},
  {id:'alice',name:'Alice',isGM:false,active:true},
  {id:'bob',name:'Bob',isGM:false,active:true},
  {id:'charlie',name:'Charlie',isGM:false,active:true}
];
const permission=(doc,user)=>user.isGM || (doc.ownership[user.id]??doc.ownership.default??0)>=2;
const makeCollection=(values)=>{ values.get=id=>values.find(x=>x.id===id); values.has=id=>values.some(x=>x.id===id); Object.defineProperty(values,'contents',{get(){return [...values]}});return values;};
class JournalDoc {
  constructor(data){this.id=`doc${++sequence}`;this.name=data.name;this.flags=clone(data.flags);this.ownership=clone(data.ownership);}
  getFlag(scope,key){return this.flags?.[scope]?.[key];}
  testUserPermission(user,level){return permission(this,user);}
  async update(data){if(!game.user.isGM)throw new Error('PERMISSION: write denied');
    if(data.name)this.name=data.name;
    if(data.ownership)this.ownership=clone(data.ownership);
    for(const [k,v] of Object.entries(data)) if(k.startsWith('flags.')) {
      const [_,scope,key]=k.split('.');this.flags[scope]??={};this.flags[scope][key]=clone(v);
    }
    await new Promise(r=>setTimeout(r,1)); return this;
  }
  async delete(){if(!game.user.isGM)throw new Error('PERMISSION: delete denied');const i=allDocs.indexOf(this);if(i>=0)allDocs.splice(i,1);}
}
class ChatDoc {
  constructor(data,author){this.id=`msg${++sequence}`;this.author=author;this.flags=clone(data.flags);this.whisper=clone(data.whisper);}
  getFlag(scope,key){return this.flags?.[scope]?.[key];}
  async setFlag(scope,key,val){this.flags[scope]??={};this.flags[scope][key]=val;return this;}
}
globalThis.game={
  user:users[0],users:makeCollection(users),
  journal:{filter(callback){return allDocs.filter(j=>permission(j,game.user)).filter(callback);},[Symbol.iterator](){return allDocs[Symbol.iterator]();}},
  messages:{get contents(){return allMessages;}}
};
globalThis.JournalEntry={async create(data){if(!game.user.isGM)throw new Error('PERMISSION: create denied');
  const result=new JournalDoc(data);allDocs.push(result);return result;}};
globalThis.ChatMessage={async create(data){const msg=new ChatDoc(data,game.user);allMessages.push(msg);return msg;},getSpeaker(){return {};} };
const notifications={info:[],warn:[],error:[]};
globalThis.ui={notifications:{info(m){notifications.info.push(m);},warn(m){notifications.warn.push(m);},error(m){notifications.error.push(m);}}};
const {masters,availableTrees,makeTree,saveTree,requestPurchase,spendPoint,receiveRequest,refreshAll,processPendingRequests,deleteTree}=await import('../scripts/store.mjs');
const treeDoc=await makeTree('Ember Caravan');
const tree=clone(treeDoc.getFlag('brazier','data').tree);
tree.users=['alice','bob'];tree.shared.points=5;
const root=tree.nodes[0],secret=freshNode('Secret Crown',180,-110);
secret.requires=[root.id];tree.nodes.push(secret);
await saveTree(tree);
assert.equal(masters().length,1);
assert.equal(allDocs.length,3,'one private master and two per-user projections');
const ownAlice=allDocs.find(d=>d.getFlag('brazier','data')?.userId==='alice');
assert.equal(ownAlice.ownership.bob,undefined);
assert.equal(ownAlice.ownership.alice,2);
game.user=users[1];
assert.equal(availableTrees().length,1);
assert.equal(availableTrees()[0].nodes.length,1);
assert.equal(JSON.stringify(availableTrees()).includes('Secret Crown'),false);
assert.equal(allDocs.filter(j=>permission(j,game.user)).some(j=>j.getFlag('brazier','data')?.kind==='master'),false);
await assert.rejects(saveTree(tree),/Only a Storyteller/);
await requestPurchase(tree.id,root.id);
assert.equal(allMessages.length,1);
assert.deepEqual(allMessages[0].whisper,['gm']);
assert.equal(treeDoc.getFlag('brazier','data').tree.shared.points,5,'player request cannot directly charge master');
game.user=users[0];
await receiveRequest(allMessages[0]);
assert.equal(allMessages[0].getFlag('brazier','processed'),true);
assert.equal(treeDoc.getFlag('brazier','data').tree.shared.points,4);
assert.equal(treeDoc.getFlag('brazier','data').tree.shared.ranks[root.id],1);
await receiveRequest(allMessages[0]);
assert.equal(treeDoc.getFlag('brazier','data').tree.shared.points,4,'request replay cannot charge again');
game.user=users[2];
assert.equal(availableTrees()[0].nodes.length,2,'shared purchase reveals frontier to Bob');
game.user=users[3];
assert.equal(availableTrees().length,0,'unassigned Charlie sees no trees');
assert.equal(allDocs.filter(j=>permission(j,game.user)).length,0,'unassigned Charlie receives no projection documents');
game.user=users[0];
const old=clone(treeDoc.getFlag('brazier','data').tree);
const newVersion=clone(old);newVersion.name='Ember Caravan Updated';
await saveTree(newVersion);
await assert.rejects(saveTree(old),/Tree changed since it was loaded/);
// Two nearly simultaneous serialized purchases with only 1 point: exactly one can succeed.
const current=clone(treeDoc.getFlag('brazier','data').tree);
current.shared.points=1;
await saveTree(current);
const both=await Promise.allSettled([spendPoint(current.id,secret.id,'alice'),spendPoint(current.id,secret.id,'alice')]);
assert.equal(both.filter(x=>x.status==='fulfilled').length,1);
assert.equal(treeDoc.getFlag('brazier','data').tree.shared.points,0);
const toRevoke=clone(treeDoc.getFlag('brazier','data').tree);
toRevoke.users=['alice'];await saveTree(toRevoke);
game.user=users[2];assert.equal(availableTrees().length,0);
game.user=users[0];await refreshAll();assert.equal(allDocs.length,2);
await processPendingRequests();
await deleteTree(tree.id);
assert.equal(allDocs.length,0);
assert.equal(notifications.error.length,0);

// App-level integration under the same mock Foundry permission/document host.
// This catches incorrect field dispatch order and export/import time-stamp conflicts.
globalThis.foundry={applications:{api:{ApplicationV2:class{constructor() {this.rendered=false;}},HandlebarsApplicationMixin:B=>B}}};
const {BrazierApplication}=await import('../scripts/app.mjs');
const {freshTree}=await import('../scripts/model.mjs');
const app=new BrazierApplication();
const inputTree=freshTree('Imported Test Tree');
inputTree.updatedAt=1; // A prior world's clock cannot match the new master timestamp.
inputTree.nodes=[freshNode('Origin',0,0),freshNode('Target',120,-75)];
inputTree.nodes[1].requires=[inputTree.nodes[0].id];
inputTree.shared.points=37; // importing a template must never import progression.
await app._import({size:500,text:async()=>JSON.stringify({format:'brazier-tree',version:1,tree:inputTree})});
assert.equal(masters().length,1,'import must create one full master');
assert.equal(masters()[0].getFlag('brazier','data').tree.name,'Imported Test Tree');
assert.equal(masters()[0].getFlag('brazier','data').tree.shared.points,0,'import must reset saved points');
const imported=masters()[0].getFlag('brazier','data').tree;
app.treeId=imported.id;app.nodeId=imported.nodes[1].id;
await app._onChange({target:{dataset:{field:'node.requires',prereq:imported.nodes[0].id},type:'checkbox',checked:false}});
assert.deepEqual(masters()[0].getFlag('brazier','data').tree.nodes[1].requires,[],'checkbox removes prerequisite rather than assigning a boolean');
assert.equal(notifications.error.length,0,'no app-level data errors');
// Verify purchase receipts are durable when ChatMessage.setFlag fails after saving.
const requestTree=clone(masters()[0].getFlag('brazier','data').tree);
requestTree.users=['alice'];requestTree.shared.points=2;
await saveTree(requestTree);
game.user=users[1];
await requestPurchase(imported.id,imported.nodes[0].id);
const pending=allMessages.at(-1);
const originalSetFlag=pending.setFlag.bind(pending);
pending.setFlag=async()=>{throw new Error('simulated chat acknowledgment failure');};
game.user=users[0];
const oldError=console.error;
const retryLogs=[];console.error=(...args)=>retryLogs.push(args.map(String).join(' '));
try {await receiveRequest(pending);} finally {console.error=oldError;}
assert.equal(masters()[0].getFlag('brazier','data').tree.shared.points,1,'first request spent one point');
assert.equal(masters()[0].getFlag('brazier','data').tree.requestIds.includes(pending.id),true,'receipt persists with purchase');
pending.setFlag=originalSetFlag;
await receiveRequest(pending);
assert.equal(masters()[0].getFlag('brazier','data').tree.shared.points,1,'retry cannot double-charge after acknowledgment failure');
assert.equal(pending.getFlag('brazier','processed'),true,'retry repairs acknowledgment');
// DCC-style UI unit tests: editor actions, node inspector HTML, graph linkage and
// point controls using a lightweight ApplicationV2 harness (browser test covers DOM).
globalThis.window={confirm:()=>true};
app.treeId=imported.id;app.editing=true;app.nodeId=imported.nodes[0].id;
const selectedMaster=masters()[0].getFlag('brazier','data').tree;
assert.ok(app._viewNodeHtml(selectedMaster,selectedMaster.nodes[0]).includes('Origin'));
assert.ok(app._editNodeHtml(selectedMaster,selectedMaster.nodes[0]).includes('data-field="node.requires"'));
assert.ok(app._settingsHtml(selectedMaster).includes('Tree Settings'));
const act=async(kind,value)=>app._onClick({target:{closest:()=>({dataset:{act:kind,value}})}});
await act('points-plus');assert.equal(masters()[0].getFlag('brazier','data').tree.shared.points,2);
await act('points-minus');assert.equal(masters()[0].getFlag('brazier','data').tree.shared.points,1);
await act('add-node');
const extraNode=masters()[0].getFlag('brazier','data').tree.nodes.at(-1);
assert.equal(extraNode.name,'New Talent');
await act('link-mode');
await app._selectNode(imported.nodes[0].id);
await app._selectNode(extraNode.id);
assert.deepEqual(masters()[0].getFlag('brazier','data').tree.nodes.at(-1).requires,[imported.nodes[0].id]);
app.nodeId=extraNode.id;
await act('delete-node');
assert.equal(masters()[0].getFlag('brazier','data').tree.nodes.some(n=>n.id===extraNode.id),false);
await act('close-panel');await act('tree-settings');
assert.equal(app.panel,'settings');
await act('edit-toggle');assert.equal(app.editing,false);
await act('edit-toggle');assert.equal(app.editing,true);
// Node editor strings must HTML-escape user-defined talent descriptions.
const unsafe=freshNode('<img src=x onerror=alert(1)>',0,0);
unsafe.description='<svg onload=alert(1)>';
const escaped=app._viewNodeHtml(selectedMaster,unsafe);
assert.ok(escaped.includes('&lt;img') && escaped.includes('&lt;svg') && !escaped.includes('<svg onload='));
// Failed imported master write should not leave behind an unusable empty master.
const brokenImport=freshTree('Failing Imported Tree');brokenImport.nodes=[freshNode('Root',0,0)];
const oldUpdate=JournalDoc.prototype.update;
JournalDoc.prototype.update=async function(data){if(this.name.includes('Failing Imported Tree'))throw new Error('mock persistence failure');return oldUpdate.call(this,data);};
try {
  const countBefore=masters().length;
  await assert.rejects(app._import({size:100,text:async()=>JSON.stringify({format:'brazier-tree',version:1,tree:brokenImport})}),/mock persistence failure/);
  assert.equal(masters().length,countBefore,'failed import must clean up starter tree');
} finally {JournalDoc.prototype.update=oldUpdate;}
await deleteTree(imported.id);
// Queued purchases and deletion must not recreate orphan player projections.
const raceDoc=await makeTree('Delete Race');
const raceTree=clone(raceDoc.getFlag('brazier','data').tree);
raceTree.access='all';raceTree.shared.points=2;await saveTree(raceTree);
const outcomes=await Promise.allSettled([
  spendPoint(raceTree.id,raceTree.nodes[0].id,'alice'),
  deleteTree(raceTree.id)
]);
assert.equal(outcomes[0].status,'fulfilled');
assert.equal(outcomes[1].status,'fulfilled');
assert.equal(allDocs.length,0,'delete race leaves no orphan projections');

console.log('Brazier mock-Foundry store/permission integration tests: PASSED');
// GM player perspective uses the same restricted projection and validates the recipient.
const perspectiveDoc=await makeTree('Perspective Tree');const perspectiveTree=clone(perspectiveDoc.getFlag('brazier','data').tree);
perspectiveTree.users=['alice'];perspectiveTree.shared.points=2;await saveTree(perspectiveTree);
assert.equal(availableTrees(users[1]).length,1);assert.equal(availableTrees(users[2]).length,0);
await assert.rejects(spendPoint(perspectiveTree.id,perspectiveTree.nodes[0].id,'bob'),/assigned/);
await spendPoint(perspectiveTree.id,perspectiveTree.nodes[0].id,'alice');
assert.equal(availableTrees(users[1])[0].progress.points,1);
game.user=users[2];assert.equal(availableTrees(users[1]).length,0,'player cannot override perspective to another player');game.user=users[0];
await deleteTree(perspectiveTree.id);
