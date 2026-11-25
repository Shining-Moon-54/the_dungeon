import {globalesRaster,tuerKanteKey} from './scene-builder.mjs';
import {kartePlacement} from './generator.mjs';
const key=(x,y)=>x+','+y;
const safe=new Set(['eingang','ankunft','sanktum']);
export function patrolGrid(e){
 const {boden}=globalesRaster(e),allowed=new Map(),connections=new Set();
 if(e.typ==='sanctuary')return {allowed,connections};
 for(const [pos,id] of boden){const p=e.karten.get(id);if(!safe.has(p.kategorie))allowed.set(pos,id);}
 for(const p of e.karten.values())for(const t of p.tueren){
  if(!t.ziel||safe.has(p.kategorie)||safe.has(e.karten.get(t.ziel.placementId)?.kategorie))continue;
  connections.add(tuerKanteKey(p,t));
 }
 // Keep special interaction cells clear.
 for(const p of e.karten.values())for(const m of kartePlacement(e,p).marker){
  if(['eingang','treppe','portal','rast','haendler','truhe','falle','raetsel'].includes(m.art))allowed.delete(key(p.x+m.cx,p.y+m.cy));
 }
 return {allowed,connections};
}
export function patrolOptions(grid,pos,openEdges,occupied,blocks=()=>false){
 const here=grid.allowed.get(key(pos.x,pos.y));if(!here)return [];
 return [[1,0],[-1,0],[0,1],[0,-1]].flatMap(([dx,dy])=>{
  const x=pos.x+dx,y=pos.y+dy,k=key(x,y),room=grid.allowed.get(k);
  if(!room||occupied.has(k))return [];
  const edge=dx===1?key(x,y)+',v':dx===-1?key(pos.x,pos.y)+',v':dy===1?key(x,y)+',h':key(pos.x,pos.y)+',h';
  if(here!==room&&(!grid.connections.has(edge)||!openEdges.has(edge)))return [];
  if(blocks(pos,{x,y},edge))return [];
  return [{x,y,room}];
 });
}
// Conservative segment intersection, including endpoint contact.
export function crossesWall(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const box=(p,q,r)=>r.x>=Math.min(p.x,q.x)&&r.x<=Math.max(p.x,q.x)&&r.y>=Math.min(p.y,q.y)&&r.y<=Math.max(p.y,q.y);
 const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
 return (u===0&&box(a,b,c))||(v===0&&box(a,b,d))||(w===0&&box(c,d,a))||(z===0&&box(c,d,b))||(u*v<0&&w*z<0);
}
