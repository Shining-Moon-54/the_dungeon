import {KARTEN} from './prefabs.mjs';
import {validatePacks} from './custom-decks.mjs';
const essential=new Set(['eingang','treppe','sanktum']);
const playable=new Set(['raum','gang','kreuzung','sackgasse']);
/** Freeze the available card IDs on creation; adding a pack does not alter an existing seed. */
export function selectDeck(theme,packs,ids=[],includeBuiltin=true){
 if(!Object.hasOwn(KARTEN,theme)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('Ungültige Deck-Auswahl');
 const selected=new Set(ids);
 if(selected.size!==ids.length)throw Error('Doppelte Paket-Auswahl');
 const validated=validatePacks(packs);
 const chosen=validated.filter(p=>selected.has(p.id));
 if(chosen.length!==selected.size||chosen.some(p=>p.thema!==theme))throw Error('Kartenpaket fehlt oder passt nicht zum Thema');
 const builtin=KARTEN[theme].filter(c=>!c.id.startsWith('custom-')&&(includeBuiltin||essential.has(c.kategorie)));
 const cards=[...builtin,...chosen.flatMap(p=>p.resolved)];
 if(!cards.some(c=>playable.has(c.kategorie)))throw Error('Das Deck benötigt mindestens eine erweiterbare Raumkarte');
 return cards.map(c=>c.id);
}
export function catalogRows(theme,packs){
 if(!Object.hasOwn(KARTEN,theme))throw Error('Unbekanntes Thema');
 const builtin=KARTEN[theme].filter(c=>!c.id.startsWith('custom-')).map(c=>({...c,pack:'',asset:'modules/the-dungeon/assets/prefabs/'+theme+'/'+c.id+'.svg'}));
 return [...builtin,...validatePacks(packs).filter(p=>p.thema===theme).flatMap(p=>p.resolved.map(c=>({...c,pack:p.id})))];
}
