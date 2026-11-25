import {_cacheInvalidieren,freieAnker,naechsterZug,nichtErweiterbareAbschliessen,kartePlacement} from './generator.mjs';
export const modeOf=d=>d.config?.modus??'dynamisch';
export function grow(d,e,rng,anchor=null){
 if(e.typ==='sanctuary'||(modeOf(d)==='statisch'&&anchor))return null;
 const p=naechsterZug(e,rng,d.limits,anchor);if(!p&&anchor)e.abgeschlossen.add(anchor);
 nichtErweiterbareAbschliessen(e,rng,d.limits);return p;
}
// Only empty, unvisited leaf rooms without transitions/savepoints may be removed.
export function leafCandidates(d,e,protectedIds=new Set()){
 if(e.typ==='sanctuary')return [];
 const protectedRefs=new Set([...(d.savePoints??[]).filter(p=>p.ebeneNr===e.nr).map(p=>p.placementId),...(d.verbindungen??[]).flatMap(v=>[v.von,v.nach]).filter(p=>p.ebeneNr===e.nr).map(p=>p.placementId)]);
 return [...e.karten.values()].filter(p=>p.kategorie!=='eingang'&&p.kategorie!=='ankunft'&&p.kategorie!=='sanktum'&&p.kategorie!=='treppe'&&!protectedIds.has(p.id)&&!protectedRefs.has(p.id)&&p.tueren.filter(t=>t.ziel).length===1&&!kartePlacement(e,p).marker.some(m=>['treppe','portal'].includes(m.art)));
}
export function removeLeaf(e,p){const door=p.tueren.find(t=>t.ziel),ref=door.ziel;const parent=e.karten.get(ref.placementId);parent.tueren[ref.tuerIndex].ziel=null;const id=`${parent.id}:${ref.tuerIndex}`;e.anker.get(id).frei=true;e.abgeschlossen.delete(id);for(const a of [...e.anker.values()])if(a.placementId===p.id){e.anker.delete(a.id);e.abgeschlossen.delete(a.id);}e.karten.delete(p.id);_cacheInvalidieren(e);return id;}
