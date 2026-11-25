import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patrolOptions,crossesWall,patrolGrid} from '../scripts/patrol.mjs';
import {dungeonAnlegen} from '../scripts/generator.mjs';
const grid={allowed:new Map([['0,0','a'],['1,0','a'],['2,0','b'],['1,1','c']]),connections:new Set(['2,0,v'])};
test('patrol: moves within room and crosses only connected open doors',()=>{assert.deepEqual(patrolOptions(grid,{x:1,y:0},new Set(),new Set()),[{x:0,y:0,room:'a'}]);assert.deepEqual(patrolOptions(grid,{x:1,y:0},new Set(['2,0,v']),new Set()).map(p=>p.room),['b','a']);});
test('patrol: occupied cells and custom walls excluded',()=>{assert.deepEqual(patrolOptions(grid,{x:1,y:0},new Set(['2,0,v']),new Set(['0,0']),(_a,_b,edge)=>edge==='2,0,v'),[]);});
test('patrol: safe entrance excluded',()=>{const d=dungeonAnlegen('katakombe','safe');assert.equal(patrolGrid(d.ebenen[0]).allowed.size,0);});
test('patrol: segment intersection handles walls and disjoint segments',()=>{assert.ok(crossesWall({x:0,y:0},{x:2,y:0},{x:1,y:-1},{x:1,y:1}));assert.ok(!crossesWall({x:0,y:0},{x:2,y:0},{x:3,y:0},{x:4,y:0}));});
