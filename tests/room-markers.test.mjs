import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installPacks} from '../scripts/custom-decks.mjs';
import {dungeonAnlegen,freieAnker,karteHolen,kartePlatzieren,kartePlacement} from '../scripts/generator.mjs';
import {karteRotieren,gegenSeite} from '../scripts/prefabs.mjs';
import {roomContent} from '../scripts/encounters.mjs';
import {contentEntries,enemyEntries} from '../scripts/room-plan.mjs';
import {roomJournalHtml} from '../scripts/populate.mjs';
import {Rng} from '../scripts/rng.mjs';
const monsters=[{uuid:'a',name:'Skeleton',cr:.25,xp:50,type:'undead'},{uuid:'b',name:'Ghoul',cr:1,xp:200,type:'undead'}];
function fixture(category='raum'){
 const pack={id:'markers',thema:'katakombe',cards:[{id:'room',kategorie:category,asset:'map.webp',grid:['###n###','#g.G.K#','w.Q.F.o','#K.F.Q#','###s###']}]};
 installPacks([pack]);const d=dungeonAnlegen('katakombe','markers'),e=d.ebenen[0],a=freieAnker(e)[0],k=karteHolen('katakombe','custom-markers-room');const rot=[0,1,2,3].find(r=>karteRotieren(k,r).tueren.some(t=>t.seite===gegenSeite(a.seite)));
 const p=kartePlatzieren(e,new Rng(d.seed),k.id,rot,{placementId:a.placementId,tuerIndex:a.tuerIndex});
 d.config={dichten:{gegner:0,fallen:0,raetsel:0,schaetze:0},levels:[5,5,5,5],rules:'2024',difficulty:'moderate',maxCR:1};
 return {d,e,p};
}
test('markers: authored objects honor rotated positions, multiplicity and zero random density',()=>{try{const {d,e,p}=fixture();const plan=roomContent(d,e,p,monsters),card=kartePlacement(e,p);assert.equal(plan.loots.length,2);assert.equal(plan.traps.length,2);assert.equal(plan.puzzles.length,2);for(const {kind,entry} of contentEntries(plan)){const expected={loot:'truhe',trap:'falle',puzzle:'raetsel'}[kind];assert.ok(card.marker.some(m=>m.art===expected&&p.x+m.cx===entry.x&&p.y+m.cy===entry.y));}assert.deepEqual(plan,roomContent(d,e,p,monsters));}finally{installPacks([]);}});
test('markers: elite gets strongest eligible creature and encounters obey cap',()=>{try{const {d,e,p}=fixture();const plan=roomContent(d,e,p,monsters),m=kartePlacement(e,p).marker.find(m=>m.art==='gegner-elite');assert.equal(plan.encounter.monsters[0].uuid,'b');assert.deepEqual([plan.encounter.monsters[0].x,plan.encounter.monsters[0].y],[p.x+m.cx,p.y+m.cy]);assert.ok(plan.encounter.adjusted<=plan.encounter.budget);assert.ok(plan.encounter.monsters.length<=2);}finally{installPacks([]);}});
test('markers: no compendium monsters means explicit unfilled positions',()=>{try{const {d,e,p}=fixture();const plan=roomContent(d,e,p,[]);assert.equal(plan.encounter.monsters.length,0);assert.equal(plan.encounter.unfilled.length,2);assert.ok(roomJournalHtml(plan).includes('2 Gegnerposition'));}finally{installPacks([]);}});
test('markers: explicit objects work in corridors but sanctuary remains safe',()=>{try{const {d,e,p}=fixture('gang');assert.equal(roomContent(d,e,p,monsters).loots.length,2);e.typ='sanctuary';assert.deepEqual(roomContent(d,e,p,monsters),{});}finally{installPacks([]);}});
test('plans: stable distinct IDs for multiple documents and legacy single object',()=>{const plan={loots:[{x:1},{x:2}],trap:{x:3},encounter:{monsters:[{x:1},{x:2}]}};assert.deepEqual(contentEntries(plan).map(x=>x.id),['loot:0','loot:1','trap:0']);assert.deepEqual(enemyEntries(plan).map(x=>x.id),['enemy:0','enemy:1']);});
