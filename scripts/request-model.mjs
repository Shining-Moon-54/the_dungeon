const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
export function parseRequest(r){
 if(!r||r.version!==1||!id(r.dungeonId)||!id(r.sceneId)||!Number.isInteger(r.level)||r.level<1||r.level>20||!['transition','teleport','return'].includes(r.action)||!Array.isArray(r.tokens)||r.tokens.length<1||r.tokens.length>12||!r.tokens.every(id)||new Set(r.tokens).size!==r.tokens.length)throw Error('Ungültige Anfrage');
 const target=r.target;
 if(r.action==='transition'&&(!target||!id(target.placementId)||!Number.isInteger(target.index)||target.index<0||target.index>1600))throw Error('Ungültiger Übergang');
 if(r.action==='teleport'&&!id(target))throw Error('Ungültiger Save Point');
 return {version:1,dungeonId:r.dungeonId,sceneId:r.sceneId,level:r.level,action:r.action,tokens:[...r.tokens],target:r.action==='return'?null:r.action==='transition'?{placementId:target.placementId,index:target.index}:target};
}
export function nearMarker(token,xy,step=100){
 const w=(Number(token.width)||1)*step,h=(Number(token.height)||1)*step;
 const dx=Math.max(0,token.x-xy.x-step,xy.x-token.x-w),dy=Math.max(0,token.y-xy.y-step,xy.y-token.y-h);
 return dx<=step&&dy<=step;
}
export function resolveRequest(r,{sceneId,level,dungeonId,tokens,owns,markers=[],savePoints=[],returnAllowed=false,near}){
 const req=parseRequest(r);
 if(req.sceneId!==sceneId||req.level!==level||req.dungeonId!==dungeonId)throw Error('Anfrage gehört nicht zur aktuellen Dungeon-Ebene');
 const selected=req.tokens.map(id=>tokens.find(t=>t.id===id));
 if(selected.some(t=>!t||!owns(t)))throw Error('Token fehlt oder gehört nicht zum Spieler');
 let markerIndex=null;
 if(req.action==='transition'){
  markerIndex=markers.findIndex(m=>['treppe','portal'].includes(m.art)&&m.placementId===req.target.placementId&&m.index===req.target.index);
  if(markerIndex<0||!selected.every(t=>near(t,markers[markerIndex])))throw Error('Übergang nicht erreichbar');
 }
 if(req.action==='teleport'&&!savePoints.some(p=>p.id===req.target&&!p.gesperrt))throw Error('Save Point nicht freigegeben');
 if(req.action==='return'&&!returnAllowed)throw Error('Rückkehrziel fehlt');
 return {req,selected,markerIndex};
}
