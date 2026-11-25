import {KARTEN, THEMEN, karteParsen} from './prefabs.mjs';
import {deckCacheLeeren} from './generator.mjs';
const idOK = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const validId = s => typeof s==='string' && idOK.test(s);
export const CARD_CATEGORIES = Object.freeze(['raum','gang','kreuzung','sackgasse','treppe','boss']);
export function validAsset(value) {
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>2048||/[<>"'\\\x00-\x1f\x7f]/.test(value)) return false;
  if(value.startsWith('//')) return false;
  if(/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password; } catch {return false;}
  }
  return true;
}
export function validatePack(pack) {
  if (!pack || !validId(pack.id) || !Object.hasOwn(THEMEN,pack.thema) || !Array.isArray(pack.cards) || !pack.cards.length || pack.cards.length>100) throw Error('Ungültiges Kartenpaket');
  const seen=new Set();
  const cards=pack.cards.map(c=>{
    if (!c || !validId(c.id) || seen.has(c.id) || !CARD_CATEGORIES.includes(c.kategorie)) throw Error('Ungültige Karten-ID/Kategorie');
    seen.add(c.id);
    if (!Array.isArray(c.grid) || !c.grid.length || c.grid.length>40 || !c.grid.every(r=>typeof r==='string' && r.length>0 && r.length<=40)) throw Error('Karte maximal 40 × 40 Felder');
    if (!validAsset(c.asset)) throw Error('Gültiger Bildpfad erforderlich');
    const card={id:`custom-${pack.id}-${c.id}`,name:String(c.name||c.id).slice(0,120),kategorie:c.kategorie,grid:[...c.grid],asset:c.asset};
    const p=karteParsen(card,pack.thema);
    const q=[[p.tueren[0].cx,p.tueren[0].cy]], visited=new Set();
    while(q.length){const [x,y]=q.pop(),key=`${x},${y}`;if(visited.has(key)||!p.zellen[y]?.[x]?.boden)continue;visited.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
    if(visited.size!==p.zellen.flat().filter(z=>z.boden).length) throw Error('Nicht verbundene Bodenflächen');
    return card;
  });
  return {id:pack.id,thema:pack.thema,cards:pack.cards.map((c,i)=>({...cards[i],id:c.id})),resolved:cards};
}
export function validatePacks(packs) {
  if(!Array.isArray(packs)) throw Error('Kartenpakete müssen eine Liste sein');
  const normalized=packs.map(validatePack), keys=new Set(), ids=new Set();
  for(const p of normalized){
    if(keys.has(p.id)) throw Error('Doppeltes Paket');keys.add(p.id);
    for(const c of p.resolved){if(ids.has(c.id))throw Error('Mehrdeutige Karten-ID: '+c.id);ids.add(c.id);}
  }
  return normalized;
}
export function installPacks(packs) {
  const normalized=validatePacks(packs);
  for(const theme of Object.keys(KARTEN)) KARTEN[theme]=KARTEN[theme].filter(c=>!c.id.startsWith('custom-'));
  for(const p of normalized) KARTEN[p.thema].push(...p.resolved);
  deckCacheLeeren();return normalized.map(({resolved,...p})=>p);
}
let pending=Promise.resolve();
export function savePack(pack){
  const job=pending.catch(()=>{}).then(async()=>{
    if(!game.user?.isGM)throw Error('Nur GM');
    const old=game.settings.get('the-dungeon','packs');
    if(old.some(p=>p.id===pack.id)) throw Error('Paket-ID existiert; neue ID für eine neue Version verwenden.');
    const normalized=validatePacks([...old,pack]).map(({resolved,...p})=>p);
    // Do not change the running generator if persistence fails.
    await game.settings.set('the-dungeon','packs',normalized);
    installPacks(normalized);
    return normalized;
  });
  pending=job;return job;
}
