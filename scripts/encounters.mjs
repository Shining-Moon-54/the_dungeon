import {Rng} from './rng.mjs';
import {kartePlacement} from './generator.mjs';
// Numeric rule data: D&D Beyond Basic Rules 2014, Building Combat Encounters;
// Free Rules 2024, DM's Toolbox, XP Budget per Character.
const T14=[[25,50,75,100],[50,100,150,200],[75,150,225,400],[125,250,375,500],[250,500,750,1100],[300,600,900,1400],[350,750,1100,1700],[450,900,1400,2100],[550,1100,1600,2400],[600,1200,1900,2800],[800,1600,2400,3600],[1000,2000,3000,4500],[1100,2200,3400,5100],[1250,2500,3800,5700],[1400,2800,4300,6400],[1600,3200,4800,7200],[2000,3900,5900,8800],[2100,4200,6300,9500],[2400,4900,7300,10900],[2800,5700,8500,12700]];
const T24=[[50,75,100],[100,150,200],[150,225,400],[250,375,500],[500,750,1100],[600,1000,1400],[750,1300,1700],[1000,1700,2100],[1300,2000,2600],[1600,2300,3100],[1900,2900,4100],[2200,3700,4700],[2600,4200,5400],[2900,4900,6200],[3300,5400,7800],[3800,6100,9800],[4500,7200,11700],[5000,8700,14200],[5500,10700,17200],[6400,13200,22000]];
const XP={0:10,0.125:25,0.25:50,0.5:100,1:200,2:450,3:700,4:1100,5:1800,6:2300,7:2900,8:3900,9:5000,10:5900,11:7200,12:8400,13:10000,14:11500,15:13000,16:15000,17:18000,18:20000,19:22000,20:25000,21:33000,22:41000,23:50000,24:62000,25:75000,26:90000,27:105000,28:120000,29:135000,30:155000};
export const crXP=cr=>XP[parseCR(cr)]??null;
export function parseCR(v){if(typeof v==='string'&&v.includes('/')){const [a,b]=v.split('/').map(Number);return a/b;}return v==null||v===''?NaN:Number(v);}
export function budget(levels, rules='2024',difficulty='moderate'){
 const old=rules==='2014',i=(old?['easy','medium','hard','deadly']:['low','moderate','high']).indexOf(difficulty);
 if(i<0||!levels.length||levels.some(l=>!Number.isInteger(l)||l<1||l>20))throw Error('Ungültige Gruppenstufe/Schwierigkeit');
 return levels.reduce((sum,l)=>sum+(old?T14:T24)[l-1][i],0);
}
export function adjustedXP(monsters, rules, partySize){
 const raw=monsters.reduce((s,m)=>s+(m.xp??crXP(m.cr)??0),0);if(rules!=='2014'||!monsters.length)return raw;
 const n=monsters.length;let i=n===1?1:n===2?2:n<=6?3:n<=10?4:n<=14?5:6;
 i+=partySize<3?1:partySize>=6?-1:0;return raw*[0.5,1,1.5,2,2.5,3,4,5][i];
}
const TYPE={katakombe:['undead','fiend','construct'],hoehle:['beast','monstrosity','ooze','elemental'],turm:['construct','elemental','aberration','humanoid'],stadt:['humanoid','beast','fiend','undead']};
export function chooseEncounter(catalog, config, theme, rng){
 const cap=budget(config.levels,config.rules,config.difficulty);const candidates=catalog.filter(m=>Number.isFinite(m.cr)&&m.cr<=(config.maxCR??30)&&m.xp>0&&TYPE[theme]?.includes(m.type)&&m.xp<=cap);
 let result=[];
 for(let i=0;i<Math.min(8,config.levels.length*2);i++){
   const fits=candidates.filter(m=>adjustedXP([...result,m],config.rules,config.levels.length)<=cap);
   if(!fits.length)break;const sorted=fits.sort((a,b)=>b.xp-a.xp||a.name.localeCompare(b.name));result.push(rng.pick(sorted.slice(0,Math.min(5,sorted.length))));
   if(adjustedXP(result,config.rules,config.levels.length)>=cap*.7)break;
 }
 return {monsters:result,budget:cap,adjusted:adjustedXP(result,config.rules,config.levels.length)};
}
let cached;
export async function monsterCatalog(){
 if(cached)return cached;const result=[];
 for(const pack of game.packs){if(pack.documentName!=='Actor')continue;try{
  const index=await pack.getIndex({fields:['type','system.details.cr','system.details.type.value','system.details.xp.value']});
  for(const a of index){if(a.type!=='npc')continue;const cr=parseCR(a.system?.details?.cr),xp=Number(a.system?.details?.xp?.value)||crXP(cr);if(Number.isFinite(cr)&&xp>0)result.push({uuid:`Compendium.${pack.collection}.Actor.${a._id}`,name:a.name,cr,xp,type:a.system?.details?.type?.value});}
 }catch(e){console.warn('The Dungeon: compendium',pack.collection,e);}}
 cached=result.sort((a,b)=>a.uuid.localeCompare(b.uuid));return cached;
}
export function roomContent(dungeon,ebene,placement,catalog=[]){
 const rng=new Rng(`${dungeon.seed}:${ebene.nr}:${placement.id}:${placement.karte}`),conf=dungeon.config??{};
 const d=conf.dichten??{gegner:.4,fallen:.2,raetsel:.15,schaetze:.3};
 const safe=ebene.typ==='sanctuary'||['eingang','ankunft','sanktum','treppe','gang','sackgasse'].includes(placement.kategorie);
 const result={};if(safe)return result;
 const k=kartePlacement(ebene,placement),floor=k.zellen.flatMap((row,y)=>row.flatMap((z,x)=>z.boden&&!k.tueren.some(t=>t.cx===x&&t.cy===y)&&!k.marker.some(m=>m.cx===x&&m.cy===y&&['treppe','portal','eingang'].includes(m.art))?[{x:placement.x+x,y:placement.y+y}]:[]));
 const cells=rng.shuffle(floor);const take=()=>cells.shift();
 const config={levels:(conf.levels??[3,3,3,3]).map(l=>Math.min(20,l+(ebene.nr-1)*(conf.levelStep??0))),rules:conf.rules??'2024',difficulty:conf.difficulty??'moderate',maxCR:conf.maxCR??30};
 if(rng.chance(d.gegner)){const e=chooseEncounter(catalog,config,dungeon.thema,rng);const monsters=e.monsters.slice(0,cells.length).map(m=>({...m,...take()}));result.encounter={...e,monsters,adjusted:adjustedXP(monsters,config.rules,config.levels.length)};}
 if(cells.length&&rng.chance(d.schaetze))result.loot={...take(),...lootFor(dungeon.thema,Math.max(...config.levels),rng)};
 if(cells.length&&rng.chance(d.fallen))result.trap={...take(),...trapFor(dungeon.thema,Math.max(...config.levels),rng)};
 if(cells.length&&rng.chance(d.raetsel))result.puzzle={...take(),id:rng.int(1,108)};
 return result;
}
const LOOT={katakombe:['Grabbeigaben','Silbermedaillon','Onyx'],hoehle:['Edelsteinader','Kristallsplitter','Rohsilber'],turm:['Alchemistische Essenz','Runenfragment','Silberdraht'],stadt:['Schmuckstück','Handelsbarren','Münzbeutel']};
export function lootFor(theme,level,rng){return {name:rng.pick(LOOT[theme]),gp:rng.int(2,10)*Math.ceil(level/2)*5};}
const TRAPS={katakombe:['Druckplatte mit Pfeilen','Grabgas'],hoehle:['Steinschlag','Brüchiger Boden'],turm:['Runenentladung','Klingenmechanismus'],stadt:['Fallgitter','Verborgene Schlinge']};
export function trapFor(theme,level,rng){const tier=level<=4?1:level<=10?2:level<=16?3:4;return {name:rng.pick(TRAPS[theme]),dc:12+tier,damage:`${[0,2,4,8,12][tier]}d10`,save:'DEX',note:'Homebrew-Richtwert; Wahrnehmung zum Entdecken, Untersuchung zum Verstehen, passende Werkzeuge zum Entschärfen. Bei misslungenem Rettungswurf Schaden, bei Erfolg kein Schaden. GM passt Art und Auswirkung an.'};}
