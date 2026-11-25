import {karteParsen,karteKanten} from './prefabs.mjs';
import {validatePack,validatePacks,CARD_CATEGORIES} from './custom-decks.mjs';
export const BRUSHES=Object.freeze(['#','.','n','o','s','w','g','G','K','F','Q','T','P','R','H','E']);
const doors=new Set(['n','o','s','w']);
function dimension(n){if(!Number.isInteger(n)||n<3||n>40)throw Error('Raster: 3–40 Felder');return n;}
export function newGrid(w=8,h=8){
  dimension(w);dimension(h);
  return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>y===0&&x===Math.floor(w/2)?'n':x===0||x===w-1||y===0||y===h-1?'#':'.').join(''));
}
export function blankCard(id='room-1'){return {id,name:'',kategorie:'raum',asset:'',grid:newGrid()};}
export function paint(grid,x,y,brush){
  if(!BRUSHES.includes(brush)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||y>=grid.length||x>=grid[0].length)throw Error('Ungültige Rasterzelle');
  if(doors.has(brush)&&!((brush==='n'&&y===0)||(brush==='s'&&y===grid.length-1)||(brush==='w'&&x===0)||(brush==='o'&&x===grid[0].length-1)))throw Error('Tür muss am passenden Kartenrand liegen');
  return grid.map((r,i)=>i===y?r.slice(0,x)+brush+r.slice(x+1):r);
}
export function resizeGrid(grid,w,h){
  dimension(w);dimension(h);
  for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++){
    const c=grid[y][x];
    if((x>=w||y>=h)&&c!=='#')throw Error('Verkleinern würde Boden oder Marker abschneiden');
    if(x<w&&y<h&&((c==='s'&&y!==h-1)||(c==='o'&&x!==w-1)))throw Error('Östliche/südliche Türen vor Größenänderung entfernen oder versetzen');
  }
  return Array.from({length:h},(_,y)=>(grid[y]??'').slice(0,w).padEnd(w,'#'));
}
export function forkPack(pack,newId){
  return {id:newId,thema:pack.thema,cards:pack.cards.map(c=>({...c,grid:[...c.grid]}))};
}
export function nextCardId(cards){let n=1;while(cards.some(c=>c.id==='room-'+n))n++;return 'room-'+n;}
export function draftStatus(pack,existing=[]){
  try {
    const p=validatePack(pack);
    validatePacks([...existing,pack]);
    const metrics=p.resolved.map(c=>{const parsed=karteParsen(c,p.thema),edges=karteKanten(parsed);return {id:c.id,doors:parsed.tueren.length,walls:edges.waende.size,markers:parsed.marker.length};});
    return {ok:true,metrics};
  }catch(err){return {ok:false,error:err.message,metrics:[]};}
}
export {CARD_CATEGORIES};
