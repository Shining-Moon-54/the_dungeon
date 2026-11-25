// Pure room plan helpers. Keep solution-bearing plans on GM-only journals, never scene flags.
export function contentEntries(plan){
 const out=[];
 for(const [kind,plural] of [['loot','loots'],['trap','traps'],['puzzle','puzzles']]){
  const list=plan[plural]??(plan[kind]?[plan[kind]]:[]);
  list.forEach((entry,i)=>out.push({kind,id:kind+':'+i,entry}));
 }
 return out;
}
export const enemyEntries=plan=>(plan.encounter?.monsters??[]).map((entry,i)=>({id:'enemy:'+i,entry}));
export function planIdentity(d,e,p){return d.id+':'+e.nr+':'+p.id;}
