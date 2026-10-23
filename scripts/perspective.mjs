/** A presentation/action perspective, never a mutation of game.user. */
export function viewingAs(app){
  if(!game.user.isGM)return game.user;
  const user=game.users.get(app.viewAsUserId);
  return user&&!user.isGM?user:game.user;
}
export const storyteller=app=>Boolean(game.user.isGM&&viewingAs(app).isGM);
export function setPerspective(app,id){
  if(!game.user.isGM)throw new Error("Only the Storyteller can view as a player.");
  if(id&&(!game.users.get(id)||game.users.get(id).isGM))throw new Error("Choose a player account.");
  app.viewAsUserId=id||null;app.editing=false;app.panel=null;app.nodeId=null;app.linking=false;app.linkSource=null;
}
