import {settingsRegistrieren, MODUL_ID as M, dungeonKonfiguration} from './settings.mjs';
import {dungeonAnlegen, ebeneGenerieren, freieAnker, kartePlacement} from './generator.mjs';
import {ebeneSyncSzene, neueDungeonId, markerPixel, szenenOffset} from './scene-builder.mjs';
import {zustandSpeichern, zustandLesen, zustandSerialisieren, zustandDeserialisieren} from './persistenz.mjs';
import {verbindungOeffnen, markerDerEbene} from './levels.mjs';
import {sanktumAnlegen,sanktumAlsSavePoint,savePointSperren,savePointRegistrieren,verfuegbareSavePoints,rueckkehrZiel} from './sanctuary.mjs';
import {tuerInfoLesen, AUSLOESER} from './triggers.mjs';
import {Rng} from './rng.mjs';
import {selectDeck} from './deck-selection.mjs';
import {installPacks,savePack} from './custom-decks.mjs';
import {populateLevel} from './populate.mjs';
import {modeOf,grow,leafCandidates,removeLeaf} from './modes.mjs';
import {connectedCells,nearCells,planArrival} from './arrival.mjs';
import {openDashboard,openPlayerPanel} from './dashboard.mjs';
const aktiv=new Map(),queues=new Map(),history=new Map();
const gm=()=>{if(!game.user?.isGM)throw Error('Nur GM');};
const primary=()=>game.user?.isGM && (!game.users.activeGM || game.users.activeGM.id===game.user.id);
const notify=e=>{console.error(M,e);ui.notifications.error(`The Dungeon: ${e.message??e}`);};
const clone=x=>structuredClone(x);
function queue(id,job){const prev=queues.get(id)??Promise.resolve();const next=prev.catch(()=>{}).then(job);queues.set(id,next);next.finally(()=>{if(queues.get(id)===next)queues.delete(id);}).catch(()=>{});return next;}
function loadAll(){aktiv.clear();for(const scene of game.scenes){const id=scene.getFlag(M,'dungeonId');if(!id||scene.getFlag(M,'archived')||aktiv.has(id))continue;try{const e=zustandLesen(scene);if(e)aktiv.set(id,e);}catch(e){notify(e);}}}
function get(id){gm();const e=aktiv.get(id);if(!e)throw Error('Dungeon nicht gefunden');return e;}
function level(d,n){const e=d.ebenen.find(e=>e.nr===Number(n));if(!e)throw Error('Ebene nicht gefunden');return e;}
function sceneFor(d,e){return game.scenes.get(d.szenenIds?.[e.nr]);}
function snap(e){return clone(zustandSerialisieren(e.dungeon,e.rng));}
async function sync(d,e,rng){const {scene}=await ebeneSyncSzene(d,e,{szenenId:d.szenenIds?.[e.nr],name:`${d.name??'The Dungeon'} – E${e.nr}${e.typ==='sanctuary'?' · Sanktum':''}`});d.szenenIds??={};d.szenenIds[e.nr]=scene.id;await zustandSpeichern(d,rng);try{await populateLevel(d,e,scene);}catch(err){console.warn(M,'Rauminhalte konnten nicht vollständig erstellt werden',err);ui.notifications.warn('Rauminhalte unvollständig – über das Dashboard erneut versuchen.');}await zustandSpeichern(d,rng);return scene;}
export async function dungeonErstellen(o={}){gm();const config=dungeonKonfiguration(o);config.levels=Array.isArray(o.levels)?o.levels:[3,3,3,3];config.rules=o.rules==='2014'?'2014':'2024';config.difficulty=o.difficulty??(config.rules==='2014'?'hard':'moderate');config.maxCR=Number.isFinite(Number(o.maxCR))?Number(o.maxCR):30;config.levelStep=Math.max(0,Math.min(5,Math.floor(Number(o.levelStep)||0)));config.autoPopulate=o.autoPopulate===true;config.reset=o.reset===true;config.interval=Math.max(0,Math.floor(Number(o.interval)||0));if(o.statisch)config.modus='statisch';
 const theme=o.thema??'katakombe';
 config.packIds=Array.isArray(o.packIds)?[...o.packIds]:[];
 config.includeBuiltin=o.includeBuiltin!==false;
 const deckIds=selectDeck(theme,game.settings.get(M,'packs'),config.packIds,config.includeBuiltin);
 const seed=String(o.seed||Date.now()),d=dungeonAnlegen(theme,seed,config.limits,deckIds);d.id=neueDungeonId();d.name=String(o.name||'The Dungeon');d.config=config;d.ausloeser=o.ausloeser??AUSLOESER.AUTOMATISCH;d.verbindungen=[];d.savePoints=[];d.sanktue=[];d.oberwelt=o.oberwelt??null;d.szenenIds={};d.content={};const rng=new Rng(seed);if(modeOf(d)==='statisch')ebeneGenerieren(d.ebenen[0],d.limits);const scene=await sync(d,d.ebenen[0],rng);aktiv.set(d.id,{dungeon:d,rng});return {dungeon:d,scene,rng};}
async function expand(id,n,anchor=null){return queue(id,async()=>{const entry=get(id),{dungeon:d,rng}=entry,e=level(d,n);if(anchor&&!freieAnker(e).some(a=>a.id===anchor))return null;const before=snap(entry),p=grow(d,e,rng,anchor);await sync(d,e,rng);if(p)history.set(id,{before,after:JSON.stringify(snap(entry)),level:e.nr,placement:p.id});return p;});}
export async function dungeonErweitern(d,rng,n=d.ebenen.at(-1).nr,anchor=null){return expand(d.id,n,anchor);}
function noPlayersViewing(scene){return !!scene && ![...game.users].some(u=>!u.isGM&&u.active&&(u.viewedScene===scene.id||u.viewedScene?.id===scene.id));}
function playerToken(t){return t.actor?.type==='character'||t.actor?.hasPlayerOwner;}
function protectedRooms(d,e,scene){const result=new Set(e.protected??[]);const off=szenenOffset(d);for(const p of e.karten.values()){const inside=(x,y)=>x>=off.x+p.x*100&&y>=off.y+p.y*100&&x<off.x+(p.x+p.karteBreite)*100&&y<off.y+(p.y+p.karteHoehe)*100;for(const t of scene.tokens)if(inside(t.x,t.y))result.add(p.id);for(const t of scene.tiles)if(!t.getFlag(M,'karte')&&inside(t.x,t.y))result.add(p.id);for(const t of scene.walls)if(!t.getFlag(M,'segment')&&inside(t.c[0],t.c[1]))result.add(p.id);}for(const w of scene.walls)if(w.door&&w.ds===1){const p=e.karten.get(w.getFlag(M,'karte'));if(p){result.add(p.id);const other=p.tueren[w.getFlag(M,'tuerIndex')]?.ziel?.placementId;if(other)result.add(other);}}return result;}
async function reshape(id,n){return queue(id,async()=>{const entry=get(id),{dungeon:d,rng}=entry,e=level(d,n),scene=sceneFor(d,e);if(!['veraendernd','chaotisch'].includes(modeOf(d)))throw Error('Dieser Modus verändert keine Räume.');if(!scene||!noPlayersViewing(scene))throw Error('Umbau nur ohne aktive Spieleransicht dieser Ebene.');const protectedIds=protectedRooms(d,e,scene);const candidates=leafCandidates(d,e,protectedIds);if(!candidates.length)return 0;let count=0;const max=modeOf(d)==='chaotisch'?Math.min(3,candidates.length):1;for(const p of rng.shuffle(candidates).slice(0,max)){const anchor=removeLeaf(e,p);for(const type of ['Note']){const docs=[...scene.getEmbeddedCollection(type)].filter(t=>t.getFlag(M,'karte')===p.id&&t.getFlag(M,'content'));if(docs.length)await scene.deleteEmbeddedDocuments(type,docs.map(t=>t.id));}grow(d,e,rng,anchor);count++;}await sync(d,e,rng);return count;});}
async function undo(id){return queue(id,async()=>{const h=history.get(id),entry=get(id),{dungeon:d}=entry;if(!h)throw Error('Keine Erweiterung zum Rückgängigmachen in dieser Sitzung.');if(h.after!==JSON.stringify(snap(entry)))throw Error('Dungeon wurde seit der Erweiterung geändert; Undo gesperrt.');const e=level(d,h.level),scene=sceneFor(d,e);if(!noPlayersViewing(scene)||protectedRooms(d,e,scene).has(h.placement)||!leafCandidates(d,e).some(p=>p.id===h.placement))throw Error('Raum ist geschützt oder nicht mehr rückgängig zu machen.');const restored=zustandDeserialisieren(h.before);const r=level(restored.dungeon,h.level);const nextId=e.naechstePlacementId;r.naechstePlacementId=Math.max(r.naechstePlacementId,nextId);await sync(restored.dungeon,r,restored.rng);aktiv.set(id,restored);history.delete(id);return true;});}
function selectedTokens(){return (canvas.tokens?.controlled??[]).map(t=>t.document);}
function arrivalPositions(tokens,dest,xy,layout){
 const step=Number(dest.grid?.size)||100;
 let cells,origin,accept;
 if(layout){
  if(step!==100)throw Error('Dungeon benötigt 100 px Raster');
  const {d,e,marker}=layout;
  const p=e.karten.get(marker.placementId)??[...e.karten.values()].find(p=>kartePlacement(e,p).zellen[marker.y-p.y]?.[marker.x-p.x]?.boden);
  if(!p)throw Error('Zielraum nicht gefunden');
  const k=kartePlacement(e,p);
  cells=connectedCells(k.grid,marker.x-p.x,marker.y-p.y);
  origin=markerPixel(d,p);
  accept=()=>true;
 }else{
  // Overworld: use the requested point as origin and stay within scene bounds.
  origin=xy;cells=nearCells(0,0,6);
  const dim=dest.getDimensions?.()??dest.dimensions??{};
  const sx=Number(dim.sceneX??0),sy=Number(dim.sceneY??0),sw=Number(dim.sceneWidth??dest.width),sh=Number(dim.sceneHeight??dest.height);
  if(!Number.isFinite(sw)||!Number.isFinite(sh)||sw<=0||sh<=0)throw Error('Szenengrenzen nicht verfügbar');
  accept=r=>{
   const x=origin.x+r.x*step,y=origin.y+r.y*step,w=r.w*step,h=r.h*step;
   if(x<sx||y<sy||x+w>sx+sw||y+h>sy+sh)return false;
   // Reject footprints intersecting a wall (conservative axis-aligned envelope).
   return ![...dest.walls].some(wall=>{if(wall.door&&wall.ds===1)return false;if(wall.move===0)return false;const [ax,ay,bx,by]=wall.c;return Math.min(ax,bx)<x+w&&Math.max(ax,bx)>x&&Math.min(ay,by)<y+h&&Math.max(ay,by)>y;});
  };
 }
 const moving=new Set(tokens.filter(t=>t.parent.id===dest.id).map(t=>t.id));
 const occupied=[...dest.tokens].filter(t=>!moving.has(t.id)).map(t=>({x:(t.x-origin.x)/step,y:(t.y-origin.y)/step,w:Number(t.width)||1,h:Number(t.height)||1}));
 return planArrival(tokens,cells,occupied,accept).map(p=>({x:origin.x+p.x*step,y:origin.y+p.y*step}));
}
async function moveTokens(tokens,dest,xy,layout=null,users=null){
 gm();if(!dest||!tokens.length)throw Error('Bitte mindestens einen Token auswählen.');
 if(!xy||!Number.isFinite(xy.x)||!Number.isFinite(xy.y))throw Error('Ungültiges Ziel.');
 const origin=tokens[0].parent;if(tokens.some(t=>t.parent!==origin))throw Error('Tokens müssen aus derselben Szene stammen.');
 const positions=arrivalPositions(tokens,dest,xy,layout);
 if(origin.id===dest.id){await dest.updateEmbeddedDocuments('Token',tokens.map((t,i)=>({_id:t.id,...positions[i]})));return;}
 const copies=tokens.map((t,i)=>{const data=t.toObject();delete data._id;return {...data,...positions[i]};});
 const created=await dest.createEmbeddedDocuments('Token',copies);
 if(created.length!==tokens.length){if(created.length)await dest.deleteEmbeddedDocuments('Token',created.map(t=>t.id));throw Error('Token-Transfer unvollständig.');}
 try{await origin.deleteEmbeddedDocuments('Token',tokens.map(t=>t.id));}catch(err){throw Error(`Ziel-Tokens erstellt, Quelle konnte nicht gelöscht werden: ${err.message}. Bitte manuell prüfen.`);}
 if(users){dest.pullUsers(users);await dest.view();}else await dest.activate();
}
async function transition(id,n,idx,requested=null,users=null){return queue(id,async()=>{const entry=get(id),{dungeon:d,rng}=entry,e=level(d,n),source=sceneFor(d,e),tokens=requested??selectedTokens();if(!tokens.length||tokens.some(t=>t.parent.id!==source?.id))throw Error('Wähle Tokens auf der Ausgangsebene.');const marker=markerDerEbene(e)[Number(idx)];if(!marker||!['treppe','portal'].includes(marker.art))throw Error('Ungültiger Übergang.');const before=snap(entry);let result;try{result=verbindungOeffnen(d,e,marker,rng);}catch(err){aktiv.set(id,zustandDeserialisieren(before));throw err;}const target=result.zielEbene;if(result.neu&&modeOf(d)==='statisch')ebeneGenerieren(target,d.limits);const dest=await sync(d,target,rng);const ref=result.verbindung.von.ebeneNr===target.nr?result.verbindung.von:result.verbindung.nach;const m=markerDerEbene(target).find(m=>m.placementId===ref.placementId&&m.index===ref.index);if(!m)throw Error('Zielmarker fehlt.');await moveTokens(tokens,dest,markerPixel(d,m),{d,e:target,marker:m},users);return dest;});}
async function sanctuary(id){return queue(id,async()=>{const {dungeon:d,rng}=get(id);const e=sanktumAnlegen(d,rng);sanktumAlsSavePoint(d,e,`Sanktum ${e.nr}`);const scene=await sync(d,e,rng);return {sanktum:e,scene};});}
async function teleport(id,sp,tokens=selectedTokens(),users=null){const {dungeon:d}=get(id);const p=d.savePoints.find(s=>s.id===sp);if(!p||p.gesperrt)throw Error('Save Point nicht freigegeben');await moveTokens(tokens,game.scenes.get(d.szenenIds[p.ebeneNr]),markerPixel(d,p),{d,e:level(d,p.ebeneNr),marker:p},users);}
async function enter(id){const {dungeon:d}=get(id);const e=level(d,1),p=markerDerEbene(e,'eingang')[0];if(!p)throw Error('Eingang fehlt');await moveTokens(selectedTokens(),sceneFor(d,e),markerPixel(d,p),{d,e,marker:p});}
async function leave(id){const {dungeon:d}=get(id);const t=rueckkehrZiel(d);if(!t)throw Error('Kein Oberweltziel eingerichtet.');await moveTokens(selectedTokens(),game.scenes.get(t.szenenId),{x:t.x,y:t.y});if(d.config?.reset)await reset(id);}
async function reset(id){return queue(id,async()=>{const {dungeon:d}=get(id);const scenes=Object.values(d.szenenIds).map(id=>game.scenes.get(id)).filter(Boolean);if(scenes.some(s=>[...s.tokens].some(playerToken)||!noPlayersViewing(s)))throw Error('Reset gesperrt: Spieler befinden sich noch im Dungeon.');const c=d.config??{};const fresh=await dungeonErstellen({name:d.name,thema:d.thema,seed:`${d.seed}:reset:${(d.resetCount??0)+1}`,modus:c.modus,ausloeser:d.ausloeser,oberwelt:d.oberwelt,maxKartenProEbene:d.limits.maxKartenProEbene,maxKartenBreite:d.limits.maxAusdehnung.breite,maxKartenHoehe:d.limits.maxAusdehnung.hoehe,maxEbenen:d.limits.maxEbenen,levels:c.levels,rules:c.rules,difficulty:c.difficulty,maxCR:c.maxCR,levelStep:c.levelStep,autoPopulate:c.autoPopulate,reset:c.reset,interval:c.interval,packIds:c.packIds,includeBuiltin:c.includeBuiltin,...Object.fromEntries(Object.entries(c.dichten??{}).map(([k,v])=>['dichte'+k[0].toUpperCase()+k.slice(1),v*100]))});fresh.dungeon.resetCount=(d.resetCount??0)+1;await zustandSpeichern(fresh.dungeon,fresh.rng);for(const s of scenes)await s.setFlag(M,'archived',true);aktiv.delete(id);return fresh;});}
const api={async handleRequest(c){gm();const {req,selected,u,markerIndex}=c;const users=[u.id];if(req.action==='transition')return transition(req.dungeonId,req.level,markerIndex,selected,users);if(req.action==='teleport')return teleport(req.dungeonId,req.target,selected,users);if(req.action==='return'){const d=get(req.dungeonId).dungeon,t=rueckkehrZiel(d);if(!t)throw Error('Kein Rückkehrziel');return moveTokens(selected,game.scenes.get(t.szenenId),{x:t.x,y:t.y},null,users);}throw Error('Ungültige Anfrage');},aktiv,dungeonErstellen,dungeonErweitern:expand,verbindungBenutzen:transition,sanktumErstellen:sanctuary,teleport,enter,leave,reset,reshape,undo,savePack,
 savePoints:id=>verfuegbareSavePoints(get(id).dungeon,true),
 savePointSperren:(id,sp,locked)=>queue(id,async()=>{const {dungeon:d,rng}=get(id);savePointSperren(d,sp,locked);await zustandSpeichern(d,rng);}),
 savePointAdd:(id,n,i,name)=>queue(id,async()=>{const {dungeon:d,rng}=get(id),e=level(d,n),m=markerDerEbene(e)[Number(i)];if(!m)throw Error('Marker fehlt');savePointRegistrieren(d,e,m,name);await zustandSpeichern(d,rng);}),
 protect:(id,n,p)=>queue(id,async()=>{const {dungeon:d,rng}=get(id),e=level(d,n);e.protected??=[];if(!e.karten.has(p))throw Error('Raum fehlt');if(!e.protected.includes(p))e.protected.push(p);await zustandSpeichern(d,rng);}),
 view:async(id,n)=>sceneFor(get(id).dungeon,level(get(id).dungeon,n)).view(),
 repopulate:(id,n)=>queue(id,async()=>{const {dungeon:d,rng}=get(id);await sync(d,level(d,n),rng);}),dashboard:()=>openDashboard(api),AUSLOESER};
Hooks.once('init',settingsRegistrieren);
Hooks.once('ready',()=>{installPacks(game.settings.get(M,'packs'));if(game.user.isGM){loadAll();game.theDungeon=api;}else game.theDungeon={panel:openPlayerPanel};console.log(M,'M3–M6 preview ready');});
Hooks.on('getSceneControlButtons',controls=>{const tools=controls.tokens?.tools;if(!tools)return;tools.theDungeon={name:'theDungeon',title:'The Dungeon',icon:'fa-solid fa-dungeon',order:Object.keys(tools).length,button:true,onChange:()=>{(game.user.isGM?openDashboard(api):openPlayerPanel()).catch(notify);}};});
Hooks.on('updateWall',async(wall,changed)=>{if(!primary()||changed.ds!==1||wall.door!==1)return;const id=wall.getFlag(M,'dungeonId');if(!id)return;try{const entry=get(id),info=tuerInfoLesen(wall,entry.dungeon);if(!info)return;const anchor=`${info.placement.id}:${info.tuerIndex}`;if(entry.dungeon.ausloeser==='manuell'){await wall.update({ds:0});return;}if(entry.dungeon.ausloeser==='bestaetigung'){await wall.update({ds:0});const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'The Dungeon'},content:'<p>Nächsten Dungeonabschnitt an dieser Tür generieren?</p>',rejectClose:false});if(!ok)return;}const p=await expand(id,info.ebene.nr,anchor);if(p&&wall.parent.walls.has(wall.id)&&wall.ds!==1)await wall.update({ds:1});}catch(err){notify(err);}});
// Mark rooms entered by player characters; never reshuffle these rooms later.
Hooks.on('updateToken',(token,changed)=>{if(!primary()||!playerToken(token)||(!('x'in changed)&&!('y'in changed)))return;const id=token.parent.getFlag(M,'dungeonId'),n=token.parent.getFlag(M,'ebeneNr');if(!id||!aktiv.has(id))return;queue(id,async()=>{const {dungeon:d,rng}=get(id),e=level(d,n),o=szenenOffset(d);const x=Math.floor((token.x-o.x)/100),y=Math.floor((token.y-o.y)/100);const p=[...e.karten.values()].find(p=>kartePlacement(e,p).zellen[y-p.y]?.[x-p.x]?.boden);if(!p)return;e.protected??=[];if(e.protected.includes(p.id))return;e.protected.push(p.id);await zustandSpeichern(d,rng);}).catch(notify);});
// Time-based changes only on levels not currently viewed by players, opt-in.
const ticked=new Map();Hooks.once('ready',()=>{if(!game.user.isGM)return;setInterval(()=>{if(!primary())return;for(const [id,{dungeon:d}] of aktiv){const mins=d.config?.interval;if(!mins||!['veraendernd','chaotisch'].includes(modeOf(d)))continue;if(!ticked.has(id)){ticked.set(id,Date.now());continue;}if(Date.now()-ticked.get(id)<mins*60000)continue;ticked.set(id,Date.now());for(const e of d.ebenen){const s=sceneFor(d,e);if(s&&noPlayersViewing(s))reshape(id,e.nr).catch(console.warn);}}},30000);});
