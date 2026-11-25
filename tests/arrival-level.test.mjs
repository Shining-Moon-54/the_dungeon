import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dungeonAnlegen,freieAnker,kartePlatzieren,karteHolen} from '../scripts/generator.mjs';
import {karteRotieren,gegenSeite} from '../scripts/prefabs.mjs';
import {markerDerEbene,verbindungOeffnen} from '../scripts/levels.mjs';
import {Rng} from '../scripts/rng.mjs';
import {roomContent} from '../scripts/encounters.mjs';
import {grow} from '../scripts/modes.mjs';
import {selectDeck} from '../scripts/deck-selection.mjs';
for(const [theme,prefix] of [['katakombe','k'],['hoehle','h'],['turm','t'],['stadt','s']])test('level arrival: '+theme+' retains onward exits and reciprocal return',()=>{
 const d=dungeonAnlegen(theme,'arrival-'+theme,undefined,selectDeck(theme,[])),e=d.ebenen[0],rng=new Rng(d.seed);
 const a=freieAnker(e)[0],k=karteHolen(theme,prefix+'-treppe');const rot=[0,1,2,3].find(r=>karteRotieren(k,r).tueren.some(t=>t.seite===gegenSeite(a.seite)));
 kartePlatzieren(e,rng,k.id,rot,{placementId:a.placementId,tuerIndex:a.tuerIndex});
 const marker=markerDerEbene(e,'treppe')[0],result=verbindungOeffnen(d,e,marker,rng),target=result.zielEbene;
 assert.equal(target.karten.size,1);assert.equal([...target.karten.values()][0].kategorie,'ankunft');assert.equal(freieAnker(target).length,2);
 const back=markerDerEbene(target,'treppe')[0];assert.equal(verbindungOeffnen(d,target,back,rng).zielEbene.nr,1);
 assert.deepEqual(roomContent(d,target,[...target.karten.values()][0]),{});
 assert.ok(grow(d,target,rng,freieAnker(target)[0].id),'arrival floor can expand');
});
