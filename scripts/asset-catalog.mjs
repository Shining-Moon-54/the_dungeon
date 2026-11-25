import {THEMEN,karteParsen,karteKanten} from './prefabs.mjs';
import {catalogRows} from './deck-selection.mjs';
import {validAsset} from './custom-decks.mjs';
const L=(de,en)=>game.i18n?.lang==='de'?de:en;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openAssetCatalog(){
 if(!game.user?.isGM)return;
 const packs=game.settings.get('the-dungeon','packs');
 await foundry.applications.api.DialogV2.wait({window:{title:L('The Dungeon · Kartenbibliothek','The Dungeon · Map library')},position:{width:820},rejectClose:false,
 content:`<div class="td-panel td-library">
 <div class="td-grid"><label class="td-field"><span>${L('Thema','Theme')}</span><select data-theme>${Object.entries(THEMEN).map(([id,t])=>'<option value="'+esc(id)+'">'+esc(t.name)+'</option>').join('')}</select></label>
 <label class="td-field"><span>${L('Suche','Search')}</span><input data-search placeholder="${L('Name, ID, Kategorie, Paket','Name, ID, category, pack')}"></label></div>
 <label class="td-field"><span>${L('Quelle','Source')}</span><select data-source><option value="">${L('Alle','All')}</option><option value="builtin">${L('Standardkarten','Built-in cards')}</option><option value="custom">${L('Eigene Pakete','Custom packs')}</option></select></label>
 <div class="td-library-layout"><div data-list class="td-library-list"></div><div class="td-library-detail"><p data-detail></p><button data-preview-button type="button">${L('Bild laden','Load image')}</button><img data-image alt="" hidden><textarea data-grid readonly rows="8"></textarea></div></div>
 <details><summary>${L('Kartenpaket als JSON exportieren','Export card pack as JSON')}</summary><select data-export><option value="">—</option>${packs.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.id)+'</option>').join('')}</select><textarea data-json rows="10" readonly></textarea><button type="button" data-copy>${L('JSON auswählen','Select JSON')}</button></details>
 </div>`,
 buttons:[{action:'close',label:L('Schließen','Close')}],
 render:(_e,dialog)=>{
 const root=dialog.element.querySelector('.td-library');if(!root||root.dataset.bound)return;root.dataset.bound='1';
 const q=s=>root.querySelector('[data-'+s+']'), list=q('list'),image=q('image');let selected=null;
 function detail(c){selected=c;image.hidden=true;image.removeAttribute('src');q('preview-button').disabled=!c||!validAsset(c.asset);q('grid').value=c?c.grid.join('\n'):'';
 if(!c){q('detail').textContent=L('Keine Karte ausgewählt','No card selected');return;}
 const parsed=karteParsen(c,q('theme').value),edges=karteKanten(parsed);
 q('detail').textContent=c.name+' · '+c.kategorie+' · '+parsed.breite+' × '+parsed.hoehe+' · '+parsed.tueren.length+' '+L('Türen','doors')+' · '+edges.waende.size+' '+L('Wände','walls')+' · '+(c.pack||L('Standard','Built-in'));
 }
 function refresh(){
 const term=q('search').value.toLowerCase(),source=q('source').value;
 const rows=catalogRows(q('theme').value,packs).filter(c=>(!source||(source==='custom'?!!c.pack:!c.pack))&&[c.name,c.id,c.kategorie,c.pack].join(' ').toLowerCase().includes(term));
 list.replaceChildren();for(const c of rows){const b=document.createElement('button');b.type='button';b.textContent=c.name+' · '+c.kategorie+(c.pack?' · '+c.pack:'');b.onclick=()=>{detail(c);for(const btn of list.children)btn.setAttribute('aria-pressed',String(btn===b));};b.setAttribute('aria-pressed','false');list.append(b);}
 detail(null);if(list.firstElementChild)list.firstElementChild.click();
 }
 q('theme').onchange=refresh;q('source').onchange=refresh;q('search').oninput=refresh;
 q('preview-button').onclick=()=>{if(selected&&validAsset(selected.asset)){image.hidden=false;image.src=selected.asset;}};
 image.onerror=()=>{image.hidden=true;ui.notifications.warn(L('Bild nicht verfügbar','Image unavailable'));};
 q('export').onchange=()=>{const p=packs.find(p=>p.id===q('export').value);q('json').value=p?JSON.stringify(p,null,2):'';};
 q('copy').onclick=()=>{q('json').focus();q('json').select();};refresh();
 }});
}
