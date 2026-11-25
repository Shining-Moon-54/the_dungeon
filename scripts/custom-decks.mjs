import {KARTEN, THEMEN, karteParsen} from './prefabs.mjs';
import {deckCacheLeeren} from './generator.mjs';
const idOK = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export function validatePack(pack) {
  if (!pack || !idOK.test(pack.id) || !THEMEN[pack.thema] || !Array.isArray(pack.cards) || !pack.cards.length || pack.cards.length>100) throw Error('Ungültiges Kartenpaket');
  const seen=new Set();
  const cards=pack.cards.map(c=>{
    if (!idOK.test(c.id) || seen.has(c.id) || !['raum','gang','kreuzung','sackgasse','treppe','boss'].includes(c.kategorie)) throw Error('Ungültige Karten-ID/Kategorie');
    seen.add(c.id);
    if (!Array.isArray(c.grid) || c.grid.length>40 || !c.grid.every(r=>typeof r==='string' && r.length<=40)) throw Error('Karte maximal 40 × 40 Felder');
    if (typeof c.asset!=='string' || !c.asset.trim() || /^(?:javascript|data|file):/i.test(c.asset) || /[<>"']/g.test(c.asset)) throw Error('Bildpfad erforderlich');
    const card={id:`custom-${pack.id}-${c.id}`,name:String(c.name||c.id).slice(0,120),kategorie:c.kategorie,grid:[...c.grid],asset:c.asset};
    const p=karteParsen(card,pack.thema);
    // Reject inaccessible floor cells and exits.
    const q=[[p.tueren[0].cx,p.tueren[0].cy]], visited=new Set();
    while(q.length){const [x,y]=q.pop(),key=`${x},${y}`;if(visited.has(key)||!p.zellen[y]?.[x]?.boden)continue;visited.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
    if(visited.size!==p.zellen.flat().filter(z=>z.boden).length) throw Error('Nicht verbundene Bodenflächen');
    return card;
  });
  return {...pack,cards:pack.cards.map((c,i)=>({...cards[i],id:c.id})),resolved:cards};
}
export function installPacks(packs) {
  const normalized=packs.map(validatePack);const keys=new Set();
  for(const p of normalized){if(keys.has(p.id)) throw Error('Doppeltes Paket');keys.add(p.id);}
  for(const theme of Object.keys(KARTEN)) KARTEN[theme]=KARTEN[theme].filter(c=>!c.id.startsWith('custom-'));
  for(const p of normalized) KARTEN[p.thema].push(...p.resolved);
  deckCacheLeeren();return normalized.map(({resolved,...p})=>p);
}
export async function savePack(pack){
  const old=game.settings.get('the-dungeon','packs');
  // Immutable package identifiers keep existing saves valid.
  if(old.some(p=>p.id===pack.id)) throw Error('Paket-ID existiert; neue ID für eine neue Version verwenden.');
  const normalized=installPacks([...old,pack]);await game.settings.set('the-dungeon','packs',normalized);return normalized;
}
