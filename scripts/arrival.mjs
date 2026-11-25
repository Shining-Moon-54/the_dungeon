// Pure arrival planner: deterministic, no partial placement and no overlap.
const key=(x,y)=>x+','+y;
function size(value){const n=Number(value??1);if(!Number.isFinite(n)||n<=0||n>40)throw Error('Ungültige Token-Größe');return Math.ceil(n);}
export function overlaps(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;}
export function connectedCells(grid,x,y){
 const ok=(x,y)=>typeof grid[y]?.[x]==='string'&&grid[y][x]!=='#';
 if(!ok(x,y))throw Error('Zielmarker liegt nicht auf Boden');
 const queue=[{x,y}],visited=new Set([key(x,y)]),out=[];
 for(let i=0;i<queue.length;i++){
  const p=queue[i];out.push(p);
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const x=p.x+dx,y=p.y+dy,k=key(x,y);if(ok(x,y)&&!visited.has(k)){visited.add(k);queue.push({x,y});}
  }
 }
 return out;
}
export function nearCells(x,y,radius=5){
 const out=[];for(let d=0;d<=radius;d++)for(let dy=-d;dy<=d;dy++)for(let dx=-d;dx<=d;dx++)if(Math.abs(dx)+Math.abs(dy)===d)out.push({x:x+dx,y:y+dy});
 return out;
}
export function planArrival(tokens,cells,occupied=[],accept=()=>true){
 if(!tokens.length||!cells.length)throw Error('Kein gültiges Transferziel');
 const allowed=new Set(cells.map(c=>key(c.x,c.y))),used=[...occupied],result=new Array(tokens.length);
 const ordered=tokens.map((t,i)=>({i,w:size(t.width),h:size(t.height)})).sort((a,b)=>b.w*b.h-a.w*a.h||a.i-b.i);
 for(const t of ordered){
  let found=null;
  for(const c of cells){
   const rect={...c,w:t.w,h:t.h};
   let valid=true;
   for(let y=c.y;y<c.y+t.h&&valid;y++)for(let x=c.x;x<c.x+t.w;x++)if(!allowed.has(key(x,y))){valid=false;break;}
   if(valid&&accept(rect)&&!used.some(r=>overlaps(r,rect))){found=rect;break;}
  }
  if(!found)throw Error('Nicht genug freie zusammenhängende Zielfläche für alle Tokens');
  used.push(found);result[t.i]={x:found.x,y:found.y};
 }
 return result;
}
