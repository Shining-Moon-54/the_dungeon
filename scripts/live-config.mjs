import {patrolMinutes} from './timing.mjs';
const triggers=new Set(['automatisch','bestaetigung','manuell']);
export function behaviorSettings(d,input){
 if(!triggers.has(input.ausloeser))throw Error('Ungültiger Tür-Auslöser');
 for(const k of ['interval','patrolMinutes']){if(input[k]===''||input[k]==null||!Number.isInteger(Number(input[k]))||Number(input[k])<0||Number(input[k])>1440)throw Error('Intervall muss zwischen 0 und 1440 Minuten liegen');}
 if(typeof input.bossEnabled!=='boolean'||typeof input.reset!=='boolean')throw Error('Ungültige Schalter');
 return {...d.config,interval:patrolMinutes(input.interval),patrolMinutes:patrolMinutes(input.patrolMinutes),bossEnabled:input.bossEnabled,reset:input.reset};
}
export function applyBehavior(d,input){
 const next=behaviorSettings(d,input);
 d.config=next;d.ausloeser=input.ausloeser;
 for(const e of d.ebenen)e.bossEnabled=e.typ!=='sanctuary'&&next.bossEnabled;
 return next;
}
