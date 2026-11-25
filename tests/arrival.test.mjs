import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectedCells,nearCells,planArrival,overlaps} from '../scripts/arrival.mjs';
const grid=['#####','#...#','#...#','#...#','#####'];
test('arrival: four tokens get distinct reachable cells',()=>{const cells=connectedCells(grid,2,2),tokens=Array.from({length:4},()=>({width:1,height:1}));const positions=planArrival(tokens,cells);assert.deepEqual(positions[0],{x:2,y:2});assert.equal(new Set(positions.map(p=>p.x+','+p.y)).size,4);assert.ok(positions.every(p=>grid[p.y][p.x]==='.'));});
test('arrival: existing tokens including fractional positions are avoided',()=>{const cells=connectedCells(grid,2,2),taken={x:1.5,y:1.5,w:1,h:1};const p=planArrival([{width:1,height:1}],cells,[taken])[0];assert.ok(!overlaps({...p,w:1,h:1},taken));});
test('arrival: large token occupies whole footprint and input order preserved',()=>{const cells=connectedCells(grid,2,2);const p=planArrival([{width:1,height:1},{width:2,height:2}],cells);assert.ok(!overlaps({...p[0],w:1,h:1},{...p[1],w:2,h:2}));for(let y=p[1].y;y<p[1].y+2;y++)for(let x=p[1].x;x<p[1].x+2;x++)assert.equal(grid[y][x],'.');});
test('arrival: disconnected regions excluded; no partial layout on failure',()=>{const cells=connectedCells(['.##.','####'],0,0);assert.equal(cells.length,1);assert.throws(()=>planArrival([{width:1},{width:1}],cells));assert.throws(()=>connectedCells(grid,0,0));});
test('arrival: scene boundaries and custom constraints respected',()=>{const p=planArrival([{width:1},{width:1}],nearCells(0,0,2),[],r=>r.x>=0&&r.y>=0);assert.ok(p.every(c=>c.x>=0&&c.y>=0));assert.throws(()=>planArrival([{width:0}],nearCells(0,0,1)));});
