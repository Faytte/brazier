/** Rules and projections deliberately have no dependency on Foundry or the DOM. */
export const MODULE_ID = "brazier";
export const VERSION = 1;
export const ICONS = Object.freeze({
  flame:"fa-fire-flame-curved", star:"fa-star", moon:"fa-moon", shield:"fa-shield-halved",
  book:"fa-book-open", leaf:"fa-leaf", skull:"fa-skull", compass:"fa-compass",
  crown:"fa-crown", tent:"fa-campground", heart:"fa-heart", gem:"fa-gem",
  eye:"fa-eye", sun:"fa-sun", hand:"fa-hand-sparkles", bolt:"fa-bolt",
  sword:"fa-khanda", key:"fa-key", circle:"fa-circle-dot", wagon:"fa-truck"
});
export const BACKGROUNDS = ["ember", "parchment", "thorn", "astral", "infernal", "plain", "custom"];
export const LINES = ["minimal", "curved", "arcane", "infernal", "vines", "celestial", "chain"];
export const VISIBILITIES = ["full", "frontier", "discovered"];
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = value => structuredClone(value);
export function freshTree(name = "New Skill Tree") {
  return {
    schema: VERSION, id: uid(), name, description: "", access: "selected", users: [],
    visibility: "frontier", progression: "shared", currency: "Talent Points", pointIcon: "flame",
    background: "ember", backgroundUrl: "", line: "curved", lineColor: "#b9986b", glow: 8,
    nodes: [], shared: {points:0, ranks:{}}, personal: {}, requestIds: [], updatedAt: Date.now()
  };
}
export function freshNode(name="New Talent", x=0, y=0) {
  return {id:uid(), name, description:"", icon:"star", iconUrl:"", x, y,
    cost:1, maxRank:1, requires:[], color:"", notes:""};
}
export const isAccessible = (tree, userId) => tree.access === "all" ||
  (tree.access === "selected" && tree.users.includes(userId));
export function progressFor(tree, userId) {
  return tree.progression === "shared" ? tree.shared : (tree.personal[userId] ?? {points:0, ranks:{}});
}
export const rankOf = (progress, nodeId) => Math.max(0, Number(Object.hasOwn(progress?.ranks ?? {}, nodeId) ? progress.ranks[nodeId] : 0) || 0);
export function canBuy(tree,node,progress) {
  if (!node || rankOf(progress,node.id) >= node.maxRank) return false;
  if (!node.requires.every(id => rankOf(progress,id) > 0)) return false;
  return Number.isSafeInteger(progress?.points) && progress.points >= node.cost;
}
export function reachable(tree,node,progress) {
  return rankOf(progress,node.id) > 0 || node.requires.every(id => rankOf(progress,id) > 0);
}
/** Only return data this player is entitled to see. Never send the private master. */
export function projectTree(tree, userId) {
  if (!isAccessible(tree,userId)) return null;
  const progress = clone(progressFor(tree,userId));
  const visible = tree.nodes.filter(node => tree.visibility === "full" ||
    rankOf(progress,node.id) > 0 ||
    (tree.visibility === "frontier" && reachable(tree,node,progress)));
  return {
    schema:VERSION, id:tree.id, name:tree.name, description:tree.description,
    visibility:tree.visibility, currency:tree.currency, pointIcon:tree.pointIcon,
    background:tree.background, backgroundUrl:tree.backgroundUrl,
    line:tree.line, lineColor:tree.lineColor, glow:tree.glow,
    nodes:clone(visible.map(({notes, ...publicNode}) => publicNode)), progress
  };
}
export function purchase(tree, nodeId, userId, isStoryteller=false) {
  if (!isStoryteller && !isAccessible(tree,userId)) throw new Error("Tree not assigned to this user.");
  const node=tree.nodes.find(n=>n.id===nodeId);
  if (!node) throw new Error("Talent does not exist.");
  const progress=tree.progression === "shared" ? tree.shared :
    (tree.personal[userId] ??= {points:0,ranks:{}});
  if (!canBuy(tree,node,progress)) throw new Error("Not enough points, prerequisites unmet, or talent fully ranked.");
  progress.points -= node.cost;
  progress.ranks[node.id] = rankOf(progress,node.id) + 1;
  return {node, rank:progress.ranks[node.id]};
}
export function removeNode(tree, nodeId) {
  tree.nodes=tree.nodes.filter(n=>n.id!==nodeId);
  tree.nodes.forEach(n => {n.requires=n.requires.filter(id=>id!==nodeId);});
  delete tree.shared.ranks[nodeId];
  for (const p of Object.values(tree.personal)) delete p.ranks[nodeId];
}
/** Validate imported and edited state BEFORE it can reach a persistent world document.
 *  This is a data-integrity boundary, not a substitute for Foundry permissions. */
export function validateTree(tree) {
  const fail = message => { throw new Error(message); };
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const str = (value, max, name, blank=false) => {
    if (typeof value !== "string" || value.length > max || (!blank && !value.trim())) fail(`Invalid ${name}.`);
  };
  if (!record(tree) || tree.schema !== VERSION || !Array.isArray(tree.nodes) || tree.nodes.length > 1000)
    fail("Invalid tree schema or too many talents (limit 1000).");
  str(tree.id, 128, "tree ID");
  if (!Number.isSafeInteger(tree.updatedAt) || tree.updatedAt < 0) fail("Invalid tree revision timestamp.");
  if (tree.requestIds !== undefined && (!Array.isArray(tree.requestIds) || tree.requestIds.length > 10000 ||
      tree.requestIds.some(id => typeof id !== "string" || !id || id.length > 128) ||
      new Set(tree.requestIds).size !== tree.requestIds.length)) fail("Invalid purchase request history.");
  str(tree.name, 120, "tree name");
  str(tree.description, 5000, "description", true);
  str(tree.currency, 80, "currency name");
  if (!["all","selected","gm"].includes(tree.access)) fail("Invalid access mode.");
  if (!Array.isArray(tree.users) || tree.users.length > 500 || tree.users.some(u => typeof u !== "string" || !u || u.length > 128) || new Set(tree.users).size !== tree.users.length)
    fail("Invalid assigned player list.");
  if (!VISIBILITIES.includes(tree.visibility)) fail("Invalid visibility.");
  if (!["shared","personal"].includes(tree.progression)) fail("Invalid progression.");
  if (!BACKGROUNDS.includes(tree.background) || !LINES.includes(tree.line) || !Object.hasOwn(ICONS,tree.pointIcon)) fail("Invalid appearance preset.");
  if (!/^#[0-9a-f]{6}$/i.test(tree.lineColor) || !Number.isFinite(tree.glow) || tree.glow < 0 || tree.glow > 35) fail("Invalid connector settings.");
  str(tree.backgroundUrl, 500, "background URL", true);
  if (!record(tree.shared) || !record(tree.personal)) fail("Invalid progression data.");
  const nodes = new Set();
  for (const n of tree.nodes) {
    if (!record(n)) fail("Invalid talent.");
    str(n.id, 128, "talent ID");
    if (["__proto__","constructor","prototype"].includes(n.id)) fail("Reserved talent ID.");
    if (nodes.has(n.id)) fail("Duplicate talent ID.");
    nodes.add(n.id);
    str(n.name, 120, "talent name");
    str(n.description, 5000, "talent description", true);
    str(n.iconUrl, 500, "talent icon URL", true);
    str(n.notes, 5000, "talent notes", true);
    str(n.color, 100, "talent color", true);
    if (!Object.hasOwn(ICONS,n.icon)) fail("Invalid talent icon.");
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x)>2300 || Math.abs(n.y)>2300) fail("Invalid node position.");
    if (!Number.isSafeInteger(n.cost) || n.cost < 0 || n.cost > 999999 || !Number.isSafeInteger(n.maxRank) || n.maxRank < 1 || n.maxRank > 1000) fail("Invalid talent cost or rank.");
    if (!Array.isArray(n.requires) || n.requires.length > 1000 || new Set(n.requires).size !== n.requires.length) fail("Invalid prerequisite list.");
  }
  const lookup = new Map(tree.nodes.map(n => [n.id,n]));
  for (const n of tree.nodes) {
    if (n.requires.some(id => typeof id !== "string" || !lookup.has(id) || id === n.id)) fail("Invalid prerequisite.");
  }
  const validateProgress = (p, label) => {
    if (!record(p) || !Number.isSafeInteger(p.points) || p.points < 0 || p.points > 100000000 || !record(p.ranks)) fail(`Invalid ${label} point balance.`);
    for (const [id,rank] of Object.entries(p.ranks)) {
      if (!lookup.has(id) || !Number.isSafeInteger(rank) || rank < 0 || rank > lookup.get(id).maxRank) fail(`Invalid ${label} talent rank.`);
    }
  };
  validateProgress(tree.shared,"shared");
  if (Object.keys(tree.personal).length > 500) fail("Too many personal progression profiles.");
  for (const [userId,p] of Object.entries(tree.personal)) {
    if (!userId || userId.length > 128 || ["__proto__","constructor","prototype"].includes(userId)) fail("Invalid progression user ID.");
    validateProgress(p,`player ${userId}`);
  }
  // Iterative DFS: prevents stack overflow on large but otherwise valid imports.
  const color = new Map();
  for (const n of tree.nodes) {
    if (color.get(n.id) === 2) continue;
    const stack = [[n.id,false]];
    while (stack.length) {
      const [id, done] = stack.pop();
      if (done) { color.set(id,2); continue; }
      if (color.get(id) === 1) fail("Circular prerequisites are not allowed.");
      if (color.get(id) === 2) continue;
      color.set(id,1); stack.push([id,true]);
      for (const dep of lookup.get(id).requires) stack.push([dep,false]);
    }
  }
  return true;
}
