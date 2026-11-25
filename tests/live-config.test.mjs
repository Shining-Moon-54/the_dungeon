import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyBehavior,behaviorSettings} from '../scripts/live-config.mjs';
const input={ausloeser:'manuell',interval:'5',patrolMinutes:'2',bossEnabled:true,reset:false};
const dungeon=()=>({ausloeser:'automatisch',config:{levels:[3],rules:'2014',packIds:['a']},ebenen:[{typ:'normal',karten:new Map([['k1',{}]])},{typ:'sanctuary'}]});
test('live configuration: preserve existing layout and encounter config',()=>{const d=dungeon(),cards=d.ebenen[0].karten;applyBehavior(d,input);assert.equal(d.config.interval,5);assert.equal(d.config.patrolMinutes,2);assert.deepEqual(d.config.packIds,['a']);assert.deepEqual(d.config.levels,[3]);assert.equal(d.ebenen[0].karten,cards);assert.equal(d.ebenen[0].bossEnabled,true);assert.equal(d.ebenen[1].bossEnabled,false);assert.equal(d.ausloeser,'manuell');});
test('live configuration: invalid input causes no mutation',()=>{const d=dungeon(),before=structuredClone(d);for(const patch of [{interval:'abc'},{patrolMinutes:'-2'},{ausloeser:'invalid'},{bossEnabled:'true'},{interval:''},{interval:1441}])assert.throws(()=>applyBehavior(d,{...input,...patch}));assert.deepEqual(d,before);});
test('live configuration: zero intervals and disabled boss setting',()=>{const d=dungeon();const next=behaviorSettings(d,{...input,interval:'0',patrolMinutes:0,bossEnabled:false});assert.equal(next.interval,0);assert.equal(next.patrolMinutes,0);assert.equal(next.bossEnabled,false);assert.equal(d.config.interval,undefined);});
