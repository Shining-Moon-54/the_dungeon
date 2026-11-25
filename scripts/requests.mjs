import {parseRequest,resolveRequest,nearMarker} from './request-model.mjs';
import {markerDerEbene} from './levels.mjs';
import {markerPixel} from './scene-builder.mjs';
import {zustandLesen} from './persistenz.mjs';
const M='the-dungeon';
const L=(de,en)=>game.i18n?.lang==='de'?de:en;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owns=(t,u)=>!t.hidden&&!!t.actor?.testUserPermission(u,'OWNER');
const primary=()=>game.user?.isGM&&(!game.users.activeGM||game.users.activeGM.id===game.user.id);
const author=m=>typeof m.author==='string'?game.users.get(m.author):m.author;
const ledger=()=>game.settings.get(M,'requestLedger');
const label=r=>({transition:L('Treppe / Portal','Stairs / portal'),teleport:L('Save Point','Save point'),return:L('Rückkehr','Return')})[r.action];
function check(api,message){
 const r=parseRequest(message.getFlag(M,'request')),u=author(message);
 if(!u||u.isGM||!u.active)throw Error('Spieler nicht verfügbar');
 const d=api.aktiv.get(r.dungeonId)?.dungeon,e=d?.ebenen.find(e=>e.nr===r.level),scene=e&&game.scenes.get(d.szenenIds[e.nr]);
 if(!scene||scene.getFlag(M,'archived')||!message.whisper?.some(w=>(w.id??w)===game.user.id))throw Error('Anfrage nicht verfügbar');
 const resolved=resolveRequest(r,{sceneId:scene.id,level:e.nr,dungeonId:d.id,tokens:[...scene.tokens],owns:t=>owns(t,u),markers:markerDerEbene(e),savePoints:d.savePoints,returnAllowed:!!game.scenes.get(d.oberwelt?.szenenId),near:(t,m)=>nearMarker(t,markerPixel(d,m))});
 return {...resolved,u,d,e,scene};
}
export async function openPlayerRequests(){
 const scene=globalThis.canvas?.scene;
 if(!scene||scene.getFlag(M,'archived'))return;
 const d=zustandLesen(scene)?.dungeon,e=d?.ebenen.find(e=>e.nr===scene.getFlag(M,'ebeneNr'));
 if(!e){ui.notifications.info(L('Kein Dungeon auf dieser Szene.','No dungeon on this scene.'));return;}
 const tokens=(canvas.tokens?.controlled??[]).map(t=>t.document).filter(t=>owns(t,game.user));
 if(!tokens.length){ui.notifications.warn(L('Wähle eigene Tokens aus.','Select your own tokens.'));return;}
 const markers=markerDerEbene(e).filter(m=>['treppe','portal'].includes(m.art)&&tokens.every(t=>nearMarker(t,markerPixel(d,m))));
 const pts=(d.savePoints??[]).filter(p=>!p.gesperrt);
 const options=(xs)=>xs.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
 const result=await foundry.applications.api.DialogV2.wait({window:{title:'The Dungeon'},position:{width:520},rejectClose:false,content:`<div class="td-panel"><div class="td-stat"><strong>${esc(d.name??'The Dungeon')}</strong><span>${L('Ebene','Level')} ${e.nr} · ${tokens.length} Tokens</span></div><p>${L('Der GM bestätigt deinen Übergang.','The GM approves your transition.')}</p><label class="td-field"><span>${L('Nahe Übergänge','Nearby transitions')}</span><select name="marker">${options(markers.map((m,i)=>[i,m.art+' · '+m.placementId]))}</select></label><label class="td-field"><span>Save Point</span><select name="sp">${options(pts.map(p=>[p.id,p.name]))}</select></label></div>`,buttons:[...(markers.length?[{action:'transition',label:L('Übergang','Transition'),callback:(_ev,b)=>({action:'transition',target:markers[Number(new FormData(b.form).get('marker'))]})}]:[]),...(pts.length?[{action:'teleport',label:'Teleport',callback:(_ev,b)=>({action:'teleport',target:new FormData(b.form).get('sp')})}]:[]),...(d.oberwelt?[{action:'return',label:L('Rückkehr','Return'),callback:()=>({action:'return'})}]:[]),{action:'cancel',label:L('Schließen','Close'),callback:()=>null}]});
 if(!result)return;
 const request=parseRequest({version:1,dungeonId:d.id,sceneId:scene.id,level:e.nr,tokens:tokens.map(t=>t.id),...result});
 const gms=[...game.users].filter(u=>u.isGM).map(u=>u.id);
 if(!gms.length)throw Error('Kein GM vorhanden');
 await ChatMessage.create({content:'<p><strong>The Dungeon</strong> · '+esc(label(request))+' · '+esc(game.user.name)+'</p>',whisper:gms,flags:{[M]:{request}}});
 ui.notifications.info(L('Anfrage gesendet.','Request sent.'));
}
let processing=false;
export async function openRequestInbox(api){
 if(!primary()){ui.notifications.warn(L('Nur der aktive GM bearbeitet Anfragen.','Only the active GM handles requests.'));return;}
 if(processing)return;processing=true;
 try{while(primary()){
  const done=ledger(),pending=[...game.messages].filter(m=>m.getFlag(M,'request')&&!Object.hasOwn(done,m.id)).slice(-100);
  if(!pending.length){ui.notifications.info(L('Keine offenen Anfragen.','No pending requests.'));return;}
  const rows=pending.map(m=>{try{const c=check(api,m);return [m.id,author(m).name+' · '+label(c.req)+' · '+c.selected.map(t=>t.name).join(', ')];}catch(e){return [m.id,L('Ungültig','Invalid')+' · '+m.id];}});
  const choice=await foundry.applications.api.DialogV2.wait({window:{title:L('Dungeon-Anfragen','Dungeon requests')},position:{width:600},rejectClose:false,content:`<div class="td-panel"><label class="td-field"><span>${L('Anfrage','Request')}</span><select name="request">${rows.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('')}</select></label><p>${L('Nur die angefragten eigenen Tokens und der betreffende Spieler wechseln die Szene.','Only requested owned tokens and the requesting player change scenes.')}</p></div>`,buttons:[{action:'approve',label:L('Bestätigen','Approve'),callback:(_e,b)=>({id:new FormData(b.form).get('request'),approve:true})},{action:'reject',label:L('Ablehnen','Reject'),callback:(_e,b)=>({id:new FormData(b.form).get('request'),approve:false})},{action:'close',label:L('Schließen','Close'),callback:()=>null}]});
  if(!choice)return;
  const message=game.messages.get(choice.id);if(!message||Object.hasOwn(ledger(),choice.id))continue;
  if(!choice.approve){await game.settings.set(M,'requestLedger',{...ledger(),[choice.id]:'rejected'});continue;}
  try{
   const c=check(api,message);
   const yes=await foundry.applications.api.DialogV2.confirm({window:{title:L('Transfer bestätigen','Confirm transfer')},content:'<p>'+esc(c.u.name+' · '+label(c.req)+' · '+c.selected.map(t=>t.name).join(', '))+'</p>',rejectClose:false});
   if(!yes||!primary())continue;
   const latest=check(api,game.messages.get(choice.id));
   if(Object.hasOwn(ledger(),choice.id))continue;
   // Record before execution. A failed transfer is not automatically retried.
   await game.settings.set(M,'requestLedger',{...ledger(),[choice.id]:'processing'});
   try{await api.handleRequest(latest);await game.settings.set(M,'requestLedger',{...ledger(),[choice.id]:'approved'});}
   catch(e){await game.settings.set(M,'requestLedger',{...ledger(),[choice.id]:'failed'});throw e;}
  }catch(e){ui.notifications.warn(e.message);}
 }}finally{processing=false;}
}
