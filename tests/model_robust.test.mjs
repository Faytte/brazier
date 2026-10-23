import assert from 'node:assert/strict';
import {freshTree,freshNode,projectTree,purchase,validateTree,clone,rankOf,canBuy} from '../scripts/model.mjs';
// A deterministic test corpus so failing cases can be reproduced.
let seed=0x7e1a1234;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const pick=(array)=>array[Math.floor(random()*array.length)];
let checks=0;
for(let iteration=0;iteration<240;iteration++){
  const tree=freshTree(`Private Tree ${iteration}`);
  tree.access=pick(['all','selected','gm']);tree.visibility=pick(['full','frontier','discovered']);
  tree.progression=pick(['shared','personal']);tree.users=['alice','bob'];
  const size=4+Math.floor(random()*35),nodes=[];
  for(let i=0;i<size;i++){
    const node=freshNode(`Talent ${iteration} ${i}`,Math.round(random()*1800-900),Math.round(random()*1800-900));
    node.cost=1+Math.floor(random()*6);
    node.maxRank=1+Math.floor(random()*4);
    if(i&&random()<.80) node.requires=[nodes[Math.floor(random()*i)].id];
    nodes.push(node);
  }
  tree.nodes=nodes;
  tree.shared.points=1000;
  tree.personal={alice:{points:1000,ranks:{}},bob:{points:1000,ranks:{}}};
  assert.equal(validateTree(tree),true);checks++;
  const stranger=projectTree(tree,'stranger');
  assert.equal(stranger,tree.access==='all'?stranger:null);checks++;
  if(tree.access==='all'||tree.access==='selected'){
    for(const uid of ['alice','bob']){
      const result=projectTree(tree,uid);
      assert.ok(result);checks++;
      assert.equal(JSON.stringify(result).includes('personal'),false,'user must never get GM personal progress map');checks++;
      if(tree.visibility!=='full'){
        const unavailable=nodes.filter(n=>n.requires.length);
        if(unavailable.length){assert.ok(!result.nodes.some(n=>n.id===unavailable[0].id),'undiscovered node leaked');checks++;}
      }
      assert.notEqual(result.nodes,tree.nodes,'projection must clone');checks++;
      const changed=clone(tree);changed.access='selected';changed.users=['bob'];
      assert.equal(projectTree(changed,'alice'),null);checks++;
    }
  }
  // Purchase only first root, then check permissions and points, including repeat ranks.
  tree.access='all'; const root=nodes[0],user='alice';
  const progress=tree.progression==='shared'?tree.shared:tree.personal[user];
  const before=progress.points;
  assert.equal(canBuy(tree,root,progress),true);checks++;
  const outcome=purchase(tree,root.id,user);
  assert.equal(outcome.rank,1);checks++;
  assert.equal(progress.points,before-root.cost);checks++;
  assert.equal(rankOf(progress,root.id),1);checks++;
  for(let rank=2;rank<=root.maxRank;rank++)purchase(tree,root.id,user);
  assert.equal(canBuy(tree,root,progress),false);checks++;
  assert.throws(()=>purchase(tree,root.id,user),/fully ranked/);checks++;
}
const base=freshTree('Strict Validation');base.nodes=[freshNode('Alpha',0,0),freshNode('Beta',100,0)];
assert.equal(validateTree(base),true);
for(const [label,mutation] of [
  ['missing users',t=>delete t.users],
  ['non-array users',t=>t.users='somebody'],
  ['duplicate user IDs',t=>t.users=['a','a']],
  ['invalid colour',t=>t.lineColor='red;url(x)'],
  ['unrecognized line theme',t=>t.line='magic-unknown'],
  ['negative points',t=>t.shared.points=-1],
  ['fractional points',t=>t.shared.points=1.5],
  ['negative rank',t=>t.shared.ranks[t.nodes[0].id]=-1],
  ['foreign rank',t=>t.shared.ranks['unknown']=1],
  ['too many ranks',t=>t.shared.ranks[t.nodes[0].id]=2],
  ['duplicate node ID',t=>t.nodes[1].id=t.nodes[0].id],
  ['duplicate prerequisites',t=>t.nodes[1].requires=[t.nodes[0].id,t.nodes[0].id]],
  ['invalid prerequisites',t=>t.nodes[1].requires=['unknown']],
  ['out-of-bounds position',t=>t.nodes[1].x=9000000],
  ['invalid icon',t=>t.nodes[1].icon='../../../x'],
  ['prototype-polluting node ID',t=>t.nodes[0].id='__proto__'],
  ['reserved constructor node ID',t=>t.nodes[0].id='constructor'],
  ['invalid version timestamp',t=>t.updatedAt='yesterday'],
  ['illegal access',t=>t.access='superadmin'],
  ['unknown schema',t=>t.schema=999],
  ['oversized name',t=>t.name='A'.repeat(1000)],
  ['maxRank zero',t=>t.nodes[0].maxRank=0],
  ['self cycle',t=>t.nodes[0].requires=[t.nodes[0].id]],
  ['two-node cycle',t=>{t.nodes[0].requires=[t.nodes[1].id];t.nodes[1].requires=[t.nodes[0].id];}]
]){
  const changed=clone(base);mutation(changed);
  assert.throws(()=>validateTree(changed),undefined,`Validator accepted ${label}`);checks++;
}
// Performance and recursion resistance at maximum supported graph size.
const large=freshTree('Deep Graph');
for(let i=0;i<1000;i++){
 const node=freshNode(`Rank ${i}`,0,Math.min(2300,i*2));
 if(i)node.requires=[large.nodes[i-1].id];large.nodes.push(node);
}
assert.equal(validateTree(large),true);checks++;
large.nodes[0].requires=[large.nodes.at(-1).id];
assert.throws(()=>validateTree(large),/Circular/);checks++;
console.log(`Brazier deterministic randomized/invalid-input tests: PASSED (${checks} assertions)`);
