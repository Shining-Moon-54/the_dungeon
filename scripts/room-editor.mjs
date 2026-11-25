import {THEMEN} from './prefabs.mjs';
import {validAsset} from './custom-decks.mjs';
import {BRUSHES,CARD_CATEGORIES,blankCard,paint,resizeGrid,forkPack,nextCardId,draftStatus} from './room-editor-model.mjs';
const M='the-dungeon';
const L=(de,en)=>game.i18n?.lang==='de'?de:en;
const names={
 '#':['Fels','Rock'],'.':['Boden','Floor'],n:['Tür Nord','North door'],o:['Tür Ost','East door'],s:['Tür Süd','South door'],w:['Tür West','West door'],
 g:['Gegner','Enemy'],G:['Elite','Elite'],K:['Schatz','Loot'],F:['Falle','Trap'],T:['Treppe','Stairs'],P:['Portal','Portal'],R:['Rast','Rest'],H:['Händler','Merchant'],E:['Eingang','Entrance']
};
const nameOf=c=>L(...names[c]);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(xs)=>xs.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('');
const button=(id,t)=>`<button type="button" data-editor="${id}">${esc(t)}</button>`;
const field=(id,label,extra='')=>`<label class="td-field"><span>${esc(label)}</span><input data-editor="${id}" ${extra}></label>`;
const select=(id,label,options)=>`<label class="td-field"><span>${esc(label)}</span><select data-editor="${id}">${opts(options)}</select></label>`;
export async function openRoomEditor(api){
 if(!game.user?.isGM)return;
 const existing=game.settings.get(M,'packs');
 let draft={id:'my-pack-v1',thema:'katakombe',cards:[blankCard()]}, index=0,brush='.', validated=null, history=[];
 const content=`<div class="td-panel td-editor">
 <p>${L('Erstelle ein Kartenpaket mit eigenen Bildern und einem Raster. 1 Feld = 100 px. Gespeicherte Pakete sind unveränderlich; als neue Version kopieren.','Build a card pack from your own images and a grid. 1 cell = 100 px. Saved packs are immutable; fork a new version.')}</p>
 <div class="td-editor-row">${select('fork',L('Vorhandenes Paket','Existing pack'),[['','—'],...existing.map(p=>[p.id,p.id+' · '+p.thema])])}${button('copy',L('Als Entwurf kopieren','Fork draft'))}</div>
 <div class="td-grid">${field('pack',L('Paket-ID','Pack ID'),'maxlength="64"')}${select('theme',L('Thema','Theme'),Object.entries(THEMEN).map(([id,t])=>[id,t.name]))}</div>
 <div class="td-editor-row">${select('cards',L('Karte','Card'),[])}${button('add',L('Karte +','Add card'))}${button('remove',L('Entfernen','Remove'))}</div>
 <div class="td-grid">${field('id','ID','maxlength="64"')}${field('name',L('Name','Name'),'maxlength="120"')}${select('category',L('Kategorie','Category'),CARD_CATEGORIES.map(c=>[c,c]))}</div>
 <div class="td-editor-row">${field('asset',L('Kartenbild (Dateipfad)','Map image (file path)'),'maxlength="2048"')}${button('browse',L('Datei wählen','Browse'))}${button('preview',L('Bildvorschau','Preview image'))}</div>
 <div class="td-editor-row">${field('width',L('Breite','Width'),'type="number" min="3" max="40"')}${field('height',L('Höhe','Height'),'type="number" min="3" max="40"')}${button('resize',L('Größe anwenden','Resize'))}${button('undo','Undo')}</div>
 <div class="td-brushes" role="group" aria-label="${L('Werkzeuge','Brushes')}">${BRUSHES.map(c=>`<button type="button" data-brush="${esc(c)}" title="${esc(nameOf(c))}" aria-pressed="false"><b>${esc(c)}</b> ${esc(nameOf(c))}</button>`).join('')}</div>
 <div class="td-editor-scroll"><div class="td-editor-map"><img data-preview alt="" hidden><div data-cells class="td-editor-cells"></div></div></div>
 <p data-status role="status" aria-live="polite"></p>
 <details><summary>JSON</summary><textarea data-json rows="8" readonly></textarea></details></div>`;
 const result=await foundry.applications.api.DialogV2.wait({
 window:{title:L('The Dungeon · Raumeditor','The Dungeon · Room editor')},position:{width:900},content,rejectClose:false,
 buttons:[{action:'save',label:L('Paket speichern','Save pack'),callback:()=>validated?structuredClone(draft):null},{action:'cancel',label:L('Abbrechen','Cancel'),callback:()=>null}],
 render:(_event,dialog)=>{
 const root=dialog.element.querySelector('.td-editor');if(!root||root.dataset.bound)return;root.dataset.bound='1';
 const get=k=>root.querySelector('[data-editor="'+k+'"]'), grid=root.querySelector('[data-cells]'), img=root.querySelector('[data-preview]'),status=root.querySelector('[data-status]'), json=root.querySelector('[data-json]'),save=dialog.element.querySelector('button[data-action="save"]');
 const card=()=>draft.cards[index];
 const resetPreview=()=>{img.hidden=true;img.removeAttribute('src');};
 function validate(message=''){
   const check=draftStatus(draft,existing);validated=check.ok;
   if(save)save.disabled=!check.ok;
   status.textContent=message||(!check.ok?check.error:check.metrics[index].doors+' '+L('Türen','doors')+' · '+check.metrics[index].walls+' '+L('Wände','walls')+' · '+check.metrics[index].markers+' '+L('Marker','markers'));
   status.classList.toggle('td-invalid',!check.ok||!!message);
   json.value=JSON.stringify(draft,null,2);
 }
 function list(){get('cards').innerHTML=opts(draft.cards.map((c,i)=>[i,(i+1)+'. '+(c.name||c.id)]));get('cards').value=String(index);get('remove').disabled=draft.cards.length===1;get('add').disabled=draft.cards.length>=100;}
 function tile(b,c,x,y){b.dataset.cell=c;b.textContent=c==='#'||c==='.'?'':c;b.title=nameOf(c)+' ('+(x+1)+', '+(y+1)+')';b.setAttribute('aria-label',b.title);}
 function draw(){
   grid.replaceChildren();const rows=card().grid;grid.style.gridTemplateColumns='repeat('+rows[0].length+', 28px)';
   grid.style.width=(rows[0].length*28)+'px';
   for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
     const b=document.createElement('button');b.type='button';b.dataset.x=x;b.dataset.y=y;tile(b,rows[y][x],x,y);grid.append(b);
   }
 }
 function refresh(){list();get('pack').value=draft.id;get('theme').value=draft.thema;get('id').value=card().id;get('name').value=card().name;get('category').value=card().kategorie;get('asset').value=card().asset;get('width').value=card().grid[0].length;get('height').value=card().grid.length;history=[];resetPreview();draw();validate();}
 function setBrush(c){brush=c;for(const b of root.querySelectorAll('[data-brush]'))b.setAttribute('aria-pressed',String(b.dataset.brush===c));}
 function remember(){history.push([...card().grid]);if(history.length>100)history.shift();}
 function apply(b){const x=Number(b.dataset.x),y=Number(b.dataset.y);if(card().grid[y][x]===brush)return;try{const next=paint(card().grid,x,y,brush);remember();card().grid=next;tile(b,brush,x,y);validate();}catch(e){validate(e.message);}}
 for(const [key,prop] of [['pack','id'],['theme','thema']])get(key).addEventListener('input',()=>{draft[prop]=get(key).value;validate();});
 for(const [key,prop] of [['id','id'],['name','name'],['category','kategorie'],['asset','asset']])get(key).addEventListener('input',()=>{card()[prop]=get(key).value;if(key==='asset')resetPreview();if(key==='id'||key==='name')list();validate();});
 get('cards').addEventListener('change',()=>{index=Number(get('cards').value);refresh();});
 get('add').onclick=()=>{draft.cards.push(blankCard(nextCardId(draft.cards)));index=draft.cards.length-1;refresh();};
 get('remove').onclick=()=>{if(draft.cards.length>1&&globalThis.confirm(L('Entwurfskarte entfernen?','Remove draft card?'))){draft.cards.splice(index,1);index=Math.max(0,index-1);refresh();}};
 get('copy').onclick=()=>{const p=existing.find(p=>p.id===get('fork').value);if(!p)return;if(!globalThis.confirm(L('Aktuellen Entwurf ersetzen?','Replace current draft?')))return;let n=1,id;do{id=p.id.slice(0,52)+'-v'+n++;}while(existing.some(e=>e.id===id));draft=forkPack(p,id);index=0;refresh();};
 get('resize').onclick=()=>{try{const next=resizeGrid(card().grid,Number(get('width').value),Number(get('height').value));remember();card().grid=next;draw();validate();}catch(e){validate(e.message);}};
 get('undo').onclick=()=>{if(history.length){card().grid=history.pop();get('width').value=card().grid[0].length;get('height').value=card().grid.length;draw();validate();}};
 get('browse').onclick=()=>{const Picker=foundry.applications.apps.FilePicker;const selectedCard=card();new Picker({type:'image',current:selectedCard.asset,callback:path=>{if(!root.isConnected||card()!==selectedCard)return;card().asset=path;get('asset').value=path;resetPreview();validate();}}).render({force:true});};
 get('preview').onclick=()=>{if(!validAsset(card().asset)){validate(L('Ungültiger Bildpfad','Invalid image path'));return;}img.hidden=false;img.src=card().asset;};
 img.addEventListener('error',()=>{resetPreview();validate(L('Bild konnte nicht geladen werden','Image could not be loaded'));});
 root.querySelector('.td-brushes').addEventListener('click',ev=>{const b=ev.target.closest('[data-brush]');if(b)setBrush(b.dataset.brush);});
 grid.addEventListener('click',ev=>{const b=ev.target.closest('[data-x]');if(b)apply(b);});
 grid.addEventListener('pointerover',ev=>{const b=ev.target.closest('[data-x]');if(b&&ev.pointerType==='mouse'&&(ev.buttons&1))apply(b);});
 setBrush(brush);refresh();
 }});
 if(result){await api.savePack(result);ui.notifications.info(L('Kartenpaket gespeichert.','Card pack saved.'));}
}
