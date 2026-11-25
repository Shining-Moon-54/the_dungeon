import {roomContent,monsterCatalog} from './encounters.mjs';
import {puzzleById} from './puzzles.mjs';
import {markerPixel,MODUL} from './scene-builder.mjs';
import {contentEntries,enemyEntries,planIdentity} from './room-plan.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tag=(d,e,p)=>({dungeonId:d.id,ebeneNr:e.nr,karte:p.id,content:true});
async function folder(type,name,parent=null){let f=game.folders.find(f=>f.type===type&&f.name===name&&(f.folder?.id??null)===(parent?.id??null));if(!f)f=await Folder.create({type,name,folder:parent?.id??null});return f;}
export function roomJournalHtml(c,conf={}){
 const lines=[];
 if(c.encounter){
  const enc=c.encounter;lines.push(`<h2>${enc.elite?'Elite / ':''}Begegnung</h2><p>Budget ${enc.budget} XP; geplant ${enc.adjusted} XP (${esc(conf.rules??'2024')}).</p>`);
  if(!enc.monsters.length)lines.push('<p>Keine geeigneten Monster im zugänglichen Kompendium gefunden.</p>');
  for(const m of enc.monsters)lines.push(`<p>${esc(m.name)} (CR ${m.cr}, ${m.xp} XP) · (${m.x}, ${m.y})</p>`);
  if(enc.unfilled?.length)lines.push(`<p>${enc.unfilled.length} Gegnerposition(en) ohne passende Besetzung; Budget/CR-Grenze eingehalten.</p>`);
 }
 for(const {kind,entry:p} of contentEntries(c)){
  if(kind==='loot')lines.push(`<h2>Schatz</h2><p>${esc(p.name)}, Wert ${p.gp} GM. Position ${p.x}, ${p.y}. GM vergibt Beute manuell.</p>`);
  if(kind==='trap')lines.push(`<h2>Falle</h2><p>${esc(p.name)}; SG ${p.dc}; ${esc(p.damage)}; ${esc(p.note)} · (${p.x}, ${p.y})</p>`);
  if(kind==='puzzle'){const q=puzzleById(p.id);if(q)lines.push(`<h2>Rätsel: ${esc(q.title)}</h2><p>Position ${p.x}, ${p.y}</p><h3>Spielerinformation</h3><p>${esc(q.prompt)}</p><h3>Nur GM</h3><p>Lösung: ${esc(q.solution)}</p><p>${esc(q.gm)}</p><p>${esc(q.skill)} SG ${q.dc}: ${esc(q.hint)}</p>`);}
 }
 return lines.join('');
}
export async function populateRoom(d,e,p,scene){
 const key=`${e.nr}:${p.id}`;d.content??={};if(d.content[key])return;
 if(e.typ==='sanctuary'){d.content[key]=true;return;}
 const identity=planIdentity(d,e,p),flags=tag(d,e,p),conf=d.config??{};
 const levelName=`${d.name??'The Dungeon'} [${d.id.slice(-8)}] – E${e.nr}`;
 let journal=game.journal.find(j=>j.getFlag(MODUL,'roomKey')===identity);
 let plan=journal?.getFlag(MODUL,'roomPlan');
 // Persist the plan before creating any tokens/notes. A retry must use the same plan.
 if(!plan){
  plan=roomContent(d,e,p,await monsterCatalog());
  const html=roomJournalHtml(plan,conf);
  if(!html){d.content[key]=true;return;}
  if(journal){
   // Legacy room journal may already have manual edits. Do not overwrite its pages.
   await journal.setFlag(MODUL,'roomPlan',plan);
  }else{
   const root=await folder('JournalEntry','The Dungeon'),sub=await folder('JournalEntry',levelName,root);
   journal=await JournalEntry.create({name:`${p.id} – ${p.kategorie}`,folder:sub.id,ownership:{default:0},flags:{[MODUL]:{roomKey:identity,roomPlan:plan}},pages:[{name:'GM – Raum',type:'text',text:{content:html,format:1},ownership:{default:0}}]});
  }
 }
 if(conf.autoPopulate){
  const enemies=enemyEntries(plan);
  if(enemies.length){
   const root=await folder('Actor','The Dungeon'),sub=await folder('Actor',levelName,root);
   for(const {id,entry:m} of enemies){
    if([...scene.tokens].some(t=>t.getFlag(MODUL,'karte')===p.id&&t.getFlag(MODUL,'contentId')===id))continue;
    let actor=game.actors.find(a=>a.folder?.id===sub.id&&a.getFlag(MODUL,'sourceUuid')===m.uuid);
    if(!actor){const source=await fromUuid(m.uuid);if(!source)throw Error('Monsterquelle fehlt: '+m.uuid);const data=source.toObject();delete data._id;actor=await Actor.create({...data,folder:sub.id,ownership:{default:0},flags:{...(data.flags??{}),[MODUL]:{sourceUuid:m.uuid,dungeonId:d.id}}});}
    const xy=markerPixel(d,m);
    const legacy=[...scene.tokens].find(t=>t.getFlag(MODUL,'karte')===p.id&&!t.getFlag(MODUL,'contentId')&&t.actorId===actor.id&&t.x===xy.x&&t.y===xy.y);
    if(legacy){await legacy.setFlag(MODUL,'contentId',id);continue;}
    const td=await actor.getTokenDocument({...xy,hidden:true,actorLink:false});const data=td.toObject();delete data._id;
    await scene.createEmbeddedDocuments('Token',[{...data,flags:{...(data.flags??{}),[MODUL]:{...flags,contentId:id}}}]);
   }
  }
  for(const {kind,id,entry:pos} of contentEntries(plan)){
   if([...scene.notes].some(n=>n.getFlag(MODUL,'karte')===p.id&&n.getFlag(MODUL,'contentId')===id))continue;
   const xy=markerPixel(d,pos);
   const legacy=[...scene.notes].find(n=>n.getFlag(MODUL,'karte')===p.id&&!n.getFlag(MODUL,'contentId')&&n.getFlag(MODUL,'kind')===kind&&n.x===xy.x+50&&n.y===xy.y+50);
   if(legacy){await legacy.setFlag(MODUL,'contentId',id);continue;}
   await scene.createEmbeddedDocuments('Note',[{x:xy.x+50,y:xy.y+50,entryId:journal.id,pageId:journal.pages.contents[0]?.id,text:{label:kind==='loot'?'Schatz':kind==='trap'?'Falle':'Rätsel'},texture:{src:'icons/svg/book.svg'},iconSize:40,flags:{[MODUL]:{...flags,kind,contentId:id}}}]);
  }
 }
 d.content[key]=true;
}
export async function populateLevel(d,e,scene){const failed=[];for(const p of e.karten.values())try{await populateRoom(d,e,p,scene);}catch(err){failed.push(p.id+': '+err.message);}if(failed.length)throw Error(failed.join('; '));}
