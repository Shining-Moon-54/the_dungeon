import {contentEntries,planIdentity} from './room-plan.mjs';
import {applyRoomAction,itemStatus,publicPuzzleText} from './room-actions.mjs';
import {puzzleById} from './puzzles.mjs';
const M='the-dungeon';
const L=(de,en)=>game.i18n?.lang==='de'?de:en;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabel=s=>({pending:L('Offen','Pending'),claimed:L('Vergeben','Claimed'),triggered:L('Ausgelöst','Triggered'),disarmed:L('Entschärft','Disarmed'),solved:L('Gelöst','Solved')})[s]??s;
function current(api,did,n,pid){
 if(!game.user?.isGM)throw Error('Nur GM');
 const d=api.aktiv.get(did)?.dungeon,e=d?.ebenen.find(e=>e.nr===n),p=e?.karten.get(pid),scene=e&&game.scenes.get(d.szenenIds[n]);
 if(!p||!scene||scene.getFlag(M,'archived'))throw Error('Raum nicht mehr aktiv');
 const j=game.journal.find(j=>j.getFlag(M,'roomKey')===planIdentity(d,e,p));
 return {d,e,p,scene,j,plan:j?.getFlag(M,'roomPlan'),state:j?.getFlag(M,'roomState')??{}};
}
export async function openRoomControl(api,did,n,pid){
 if(!game.user?.isGM)return;
 while(true){
  const ctx=current(api,did,n,pid);
  if(!ctx.j||!ctx.plan){ui.notifications.info(L('Kein neuer Raumplan vorhanden. Ältere Inhalte im GM-Journal ansehen.','No new room plan available. See the GM journal for older contents.'));if(ctx.j)ctx.j.sheet.render(true);return;}
  const entries=contentEntries(ctx.plan);
  const enemies=[...ctx.scene.tokens].filter(t=>t.getFlag(M,'karte')===pid&&t.getFlag(M,'content')&&t.getFlag(M,'dungeonId')===did);
  const html=entries.map(({id,kind,entry:p})=>{
   const label=kind==='loot'?p.name+' · '+p.gp+' GP':kind==='trap'?p.name+' · DC '+p.dc+' · '+p.damage:puzzleById(p.id)?.title??'Puzzle';
   return `<option value="${esc(id)}">${esc(label)} — ${esc(statusLabel(itemStatus(ctx.state,id)))}</option>`;
  }).join('');
  const result=await foundry.applications.api.DialogV2.wait({window:{title:'The Dungeon · '+pid},position:{width:680},rejectClose:false,
   content:`<div class="td-panel"><h2>${L('Rauminhalte','Room contents')}</h2><p>${enemies.length} ${L('Gegner-Tokens','enemy tokens')} · ${enemies.filter(t=>t.hidden).length} ${L('verdeckt','hidden')}</p><label class="td-field"><span>${L('Inhalt','Content')}</span><select name="item">${html||'<option value="">—</option>'}</select></label><label class="td-field"><span>${L('Rätselantwort (optional)','Puzzle answer (optional)')}</span><input name="answer" maxlength="500"></label><p class="td-muted">${L('Beute und Schaden werden nicht automatisch auf Charakterbögen angewendet. Rätseltexte/Hinweise werden erst auf GM-Anweisung im Chat veröffentlicht.','Loot and damage are not automatically applied to sheets. Puzzle prompts and hints are shared only on GM command.')}</p></div>`,
   buttons:[['journal',L('GM-Journal','GM journal')],['reveal',L('Gegner enthüllen','Reveal enemies')],['prompt',L('Rätsel zeigen','Share puzzle')],['hint',L('Hinweis zeigen','Share hint')],['answer',L('Antwort prüfen','Check answer')],['accept',L('Lösung akzeptieren','Accept answer')],['disarm',L('Falle entschärfen','Disarm trap')],['trigger',L('Falle auslösen','Trigger trap')],['claim',L('Beute vergeben','Mark loot awarded')],['close',L('Schließen','Close')]].map(([action,label])=>({action,label,callback:(_ev,b)=>({action,...Object.fromEntries(new FormData(b.form))})}))});
  if(!result||result.action==='close')return;
  // Read state again after dialog; never act on an outdated room snapshot.
  const latest=current(api,did,n,pid);
  try{
   if(result.action==='journal'){latest.j.sheet.render(true);continue;}
   if(result.action==='reveal'){
    await api.protect(did,n,pid);
    const tokens=[...latest.scene.tokens].filter(t=>t.getFlag(M,'karte')===pid&&t.getFlag(M,'content')&&t.getFlag(M,'dungeonId')===did&&t.hidden);
    if(tokens.length)await latest.scene.updateEmbeddedDocuments('Token',tokens.map(t=>({_id:t.id,hidden:false})));
    continue;
   }
   if(['prompt','hint'].includes(result.action)){
    const msg=publicPuzzleText(latest.plan,result.item,result.action);
    const ok=await foundry.applications.api.DialogV2.confirm({window:{title:L('Im öffentlichen Chat zeigen?','Share in public chat?')},content:'<p>'+esc(msg.title)+'</p>',rejectClose:false});
    if(ok){await api.protect(did,n,pid);await ChatMessage.create({content:'<h3>'+esc(msg.title)+'</h3><p>'+esc(msg.text)+'</p>'});}
    continue;
   }
   const change=applyRoomAction(latest.plan,latest.state,result.item,result.action,result.answer);
   if(!change.changed){ui.notifications.info(L('Antwort nicht als exakt erkannt. Sinngleiche Antworten kann der GM akzeptieren.','Answer not recognized exactly. The GM may accept equivalent answers.'));continue;}
   await api.protect(did,n,pid);
   await latest.j.setFlag(M,'roomState',change.state);
   ui.notifications.info(L('Raumstatus gespeichert.','Room status saved.'));
  }catch(e){ui.notifications.warn(e.message);}
 }
}
