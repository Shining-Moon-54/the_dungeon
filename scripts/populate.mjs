import {roomContent,monsterCatalog} from './encounters.mjs';
import {puzzleById} from './puzzles.mjs';
import {markerPixel,MODUL} from './scene-builder.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tag=(d,e,p)=>({[MODUL]:{dungeonId:d.id,ebeneNr:e.nr,karte:p.id,content:true}});
async function folder(type,name,parent=null){let f=game.folders.find(f=>f.type===type&&f.name===name&&(f.folder?.id??null)===(parent?.id??null));if(!f)f=await Folder.create({type,name,folder:parent?.id??null});return f;}
export async function populateRoom(d,e,p,scene){
 const key=`${e.nr}:${p.id}`;d.content??={};if(d.content[key])return;
 if(e.typ==='sanctuary'){d.content[key]=true;return;}
 const cat=await monsterCatalog();const c=roomContent(d,e,p,cat),conf=d.config??{};
 const lines=[];const flags=tag(d,e,p);const levelName=`${d.name??'The Dungeon'} [${d.id.slice(-8)}] – E${e.nr}`;
 if(c.encounter){const enc=c.encounter;lines.push(`<h2>Begegnung</h2><p>Budget ${enc.budget} XP; geplant ${enc.adjusted} XP (${esc(conf.rules??'2024')}).</p>`);if(!enc.monsters.length)lines.push('<p>Keine thematisch passenden Monster im zugänglichen Kompendium gefunden.</p>');
 const counts=new Map();for(const m of enc.monsters){const entry=counts.get(m.uuid)??{...m,count:0};entry.count++;counts.set(m.uuid,entry);}
 if(counts.size){const root=await folder('Actor','The Dungeon'),sub=await folder('Actor',levelName,root);for(const m of counts.values()){
 lines.push(`<p>${m.count} × ${esc(m.name)} (CR ${m.cr}, ${m.xp} XP) – @UUID[${esc(m.uuid)}]{${esc(m.name)}}</p>`);
 let actor=game.actors.find(a=>a.folder?.id===sub.id&&a.getFlag(MODUL,'sourceUuid')===m.uuid);if(!actor){const source=await fromUuid(m.uuid);if(!source)continue;const data=source.toObject();delete data._id;actor=await Actor.create({...data,folder:sub.id,ownership:{default:0},flags:{...(data.flags??{}),[MODUL]:{sourceUuid:m.uuid,dungeonId:d.id}}});}
 if(conf.autoPopulate){const existing=[...scene.tokens].filter(t=>t.getFlag(MODUL,'karte')===p.id&&t.actorId===actor.id);const missing=enc.monsters.filter(x=>x.uuid===m.uuid).slice(existing.length);for(const pos of missing){const xy=markerPixel(d,pos);const td=await actor.getTokenDocument({...xy,hidden:true,actorLink:false});const data=td.toObject();delete data._id;await scene.createEmbeddedDocuments('Token',[{...data,flags:{...(data.flags??{}),...flags}}]);}}
 }} }
 if(c.loot)lines.push(`<h2>Schatz</h2><p>${esc(c.loot.name)}, Wert ${c.loot.gp} GM. Position ${c.loot.x}, ${c.loot.y}. GM vergibt Beute manuell.</p>`);
 if(c.trap)lines.push(`<h2>Falle</h2><p>${esc(c.trap.name)}; SG ${c.trap.dc}; ${esc(c.trap.damage)}; ${esc(c.trap.note)}</p>`);
 if(c.puzzle){const q=puzzleById(c.puzzle.id);lines.push(`<h2>Rätsel: ${esc(q.title)}</h2><h3>Spielerinformation</h3><p>${esc(q.prompt)}</p><h3>Nur GM</h3><p>Lösung: ${esc(q.solution)}</p><p>${esc(q.gm)}</p><p>${esc(q.skill)} SG ${q.dc}: ${esc(q.hint)}</p>`);}
 if(lines.length){const root=await folder('JournalEntry','The Dungeon'),sub=await folder('JournalEntry',levelName,root);let j=game.journal.find(j=>j.getFlag(MODUL,'roomKey')===`${d.id}:${key}`);if(!j){j=await JournalEntry.create({name:`${p.id} – ${p.kategorie}`,folder:sub.id,ownership:{default:0},flags:{[MODUL]:{roomKey:`${d.id}:${key}`}},pages:[{name:'GM – Raum',type:'text',text:{content:lines.join(''),format:1},ownership:{default:0}}]});}
 if(conf.autoPopulate){for(const [kind,pos] of Object.entries({loot:c.loot,trap:c.trap,puzzle:c.puzzle})){if(!pos)continue;const existing=scene.notes?.find(n=>n.getFlag(MODUL,'kind')===kind&&n.getFlag(MODUL,'karte')===p.id);if(existing)continue;const xy=markerPixel(d,pos);await scene.createEmbeddedDocuments('Note',[{x:xy.x+50,y:xy.y+50,entryId:j.id,pageId:j.pages.contents[0]?.id,text:{label:kind==='loot'?'Schatz':kind==='trap'?'Falle':'Rätsel'},texture:{src:'icons/svg/book.svg'},iconSize:40,flags:{[MODUL]:{...flags[MODUL],kind}}}]);}}
 }
 d.content[key]=true;
}
export async function populateLevel(d,e,scene){for(const p of e.karten.values())await populateRoom(d,e,p,scene);}
