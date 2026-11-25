import {patrolGrid,patrolOptions,crossesWall} from './patrol.mjs';
import {szenenOffset,markerPixel,MODUL as M} from './scene-builder.mjs';
export async function patrolStep(d,e,scene,rng){
 if(!game.user?.isGM)throw Error('Nur GM');
 if(e.typ==='sanctuary'||scene.getFlag(M,'archived'))return 0;
 if(scene.grid.size!==100)throw Error('Dungeon benötigt 100 px Raster');
 if([...(game.combats??[])].some(c=>c.started&&(c.scene?.id??c.scene)===scene.id)||game.combat?.started&&(game.combat.scene?.id??game.combat.scene)===scene.id)throw Error('Patrouille während aktivem Kampf gesperrt');
 const off=szenenOffset(d),grid=patrolGrid(e),tokens=[...scene.tokens],walls=[...scene.walls],occupied=new Set();
 const cells=t=>{const x=(t.x-off.x)/100,y=(t.y-off.y)/100,w=Number(t.width)||1,h=Number(t.height)||1,out=[];for(let i=Math.floor(x);i<Math.ceil(x+w);i++)for(let j=Math.floor(y);j<Math.ceil(y+h);j++)out.push(i+','+j);return out;};
 for(const t of tokens)for(const k of cells(t))occupied.add(k);
 const open=new Set(walls.filter(w=>w.door&&w.ds===1).map(w=>w.getFlag(M,'segment')).filter(Boolean));
 const blocked=walls.filter(w=>w.move!==0&&!(w.door&&w.ds===1));
 const blocks=(a,b)=>{const center=p=>{const v=markerPixel(d,p);return {x:v.x+50,y:v.y+50};};return blocked.some(w=>crossesWall(center(a),center(b),{x:w.c[0],y:w.c[1]},{x:w.c[2],y:w.c[3]}));};
 const updates=[];
 for(const t of tokens.filter(t=>t.getFlag(M,'dungeonId')===d.id&&t.getFlag(M,'content')&&t.actor?.type==='npc'&&!t.actor.hasPlayerOwner&&t.hidden&&t.width===1&&t.height===1)){
  const pos={x:(t.x-off.x)/100,y:(t.y-off.y)/100};
  if(!Number.isInteger(pos.x)||!Number.isInteger(pos.y))continue;
  const choices=patrolOptions(grid,pos,open,occupied,blocks);if(!choices.length)continue;
  const dest=rng.pick(choices);occupied.add(dest.x+','+dest.y);
  // Retain original room identity for content retries, but record current room separately.
  updates.push({_id:t.id,...markerPixel(d,dest),['flags.'+M+'.patrolRoom']:dest.room});
 }
 if(updates.length)await scene.updateEmbeddedDocuments('Token',updates);
 return updates.length;
}
