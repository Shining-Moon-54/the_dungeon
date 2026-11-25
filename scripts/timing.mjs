// Session-local scheduler: one action per key, no catch-up burst.
export class IntervalGate {
 constructor(){this.last=new Map();this.running=new Set();}
 due(key,minutes,now){
  if(!Number.isFinite(minutes)||minutes<=0){this.last.delete(key);return false;}
  if(!this.last.has(key)){this.last.set(key,now);return false;}
  if(this.running.has(key)||now-this.last.get(key)<minutes*60000)return false;
  this.last.set(key,now);this.running.add(key);return true;
 }
 finish(key){this.running.delete(key);}
 prune(keys){for(const k of this.last.keys())if(!keys.has(k)&&!this.running.has(k))this.last.delete(k);}
}
export function patrolMinutes(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1440,Math.floor(n))):0;}
