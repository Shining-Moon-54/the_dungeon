import {contentEntries} from './room-plan.mjs';
import {puzzleById} from './puzzles.mjs';
export function answerMatches(puzzle,input){
 if(!puzzle||typeof input!=='string'||input.length>500)return false;
 const normalize=s=>String(s).normalize('NFKC').toLocaleLowerCase('de').trim().replace(/[→,;>|]+/g,' ').replace(/[.!?]+$/g,'').replace(/\s+/g,' ');
 return normalize(puzzle.solution)===normalize(input);
}
export function itemStatus(state,id){return state?.[id]??'pending';}
export function applyRoomAction(plan,state,id,action,input=''){
 const item=contentEntries(plan).find(x=>x.id===id);
 if(!item)throw Error('Rauminhalt nicht gefunden');
 const previous=itemStatus(state,id);
 if(previous!=='pending')throw Error('Rauminhalt bereits erledigt');
 let next;
 if(item.kind==='loot'&&action==='claim')next='claimed';
 else if(item.kind==='trap'&&['disarm','trigger'].includes(action))next=action==='disarm'?'disarmed':'triggered';
 else if(item.kind==='puzzle'&&['answer','accept'].includes(action)){
  if(action==='answer'&&!answerMatches(puzzleById(item.entry.id),input))return {state:{...state},changed:false,correct:false};
  next='solved';
 }else throw Error('Aktion passt nicht zum Rauminhalt');
 return {state:{...state,[id]:next},changed:true,correct:item.kind==='puzzle'?true:undefined};
}
export function publicPuzzleText(plan,id,kind='prompt'){
 const item=contentEntries(plan).find(x=>x.id===id&&x.kind==='puzzle'),p=item&&puzzleById(item.entry.id);
 if(!p||!['prompt','hint'].includes(kind))throw Error('Ungültige Rätselinformation');
 return {title:p.title,text:p[kind]};
}
