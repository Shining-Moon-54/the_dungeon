// Original German puzzles. 12 prose puzzles + 96 independently solvable logic variants.
const originals=[
 ['Der stumme Zeuge','Ich habe keine Zunge und wiederhole doch jedes Wort. Was bin ich?','Echo','Ein Geräusch kehrt von einer Wand zurück.'],
 ['Der wachsende Abgrund','Je mehr du von mir fortnimmst, desto größer werde ich. Was bin ich?','Loch','Denke an Erde, nicht an einen Gegenstand.'],
 ['Die wandernde Uhr','Ich wandere ohne Füße, bin mittags klein und abends lang.','Schatten','Meine Länge hängt von der Sonne ab.'],
 ['Die gläserne Grenze','Ich lasse Licht hindurch, doch halte Regen auf.','Fenster','Ein Durchblick ist kein Durchgang.'],
 ['Die stumme Bibliothek','Ich trage tausend Stimmen, doch spreche nur, wenn du mich öffnest.','Buch','Die Stimmen sind geschrieben.'],
 ['Die zwei Ufer','Ich berühre beide Ufer, doch schwimme nicht.','Brücke','Man kann über mich gehen.'],
 ['Die gefangene Flamme','Ich werde kleiner, wenn ich Licht schenke.','Kerze','Wachs ist ein Hinweis.'],
 ['Der kalte Mantel','Ich bedecke Felder ohne Stoff und verschwinde in der Wärme.','Schnee','Ich falle vom Himmel.'],
 ['Der durstige Stein','Ich trage Wasser in mir und breche doch unter dem ersten warmen Sonnenstrahl.','Eis','Ich bin gefrorenes Wasser.'],
 ['Die zahnlose Wache','Ich habe Zähne, aber beiße nicht; ich ordne Haare.','Kamm','Ich passe in eine Tasche.'],
 ['Der unendliche Weg','Ich habe weder Anfang noch Ende; du kannst mich zeichnen, ohne abzusetzen.','Kreis','Alle Randpunkte liegen gleich weit vom Mittelpunkt entfernt.'],
 ['Das verschlossene Versprechen','Ich öffne eine Tür und bleibe doch draußen in deiner Hand.','Schlüssel','Meine Form passt zu einem Schloss.']
];
const puzzles=originals.map(([title,prompt,solution,hint],i)=>({id:i+1,title,prompt,solution,hint,skill:'Investigation / History',dc:12,gm:'Akzeptiere sinngleiche Lösungen. Die Tür reagiert auf das gesprochene Lösungswort.'}));
const symbols=['Mond','Sonne','Stern','Welle','Berg','Baum','Auge','Krone'];
// 8 symbol sets × 4 positions × 3 logical patterns. Explicit clues make each answer unique.
for(let set=0;set<8;set++)for(let shift=0;shift<4;shift++)for(let type=0;type<3;type++){
 const [a,b,c,d]=Array.from({length:4},(_,i)=>symbols[(set+i)%8]);
 const seq=[a,b,c,d], rotated=seq.slice(shift).concat(seq.slice(0,shift));const [w,x,y,z]=rotated;
 let prompt,solution,hint,title;
 if(type===0){title='Runenfolge';prompt=`Vier Runen (${seq.join(', ')}) müssen je einmal gedrückt werden. ${w} beginnt. ${z} endet. ${x} steht direkt vor ${y}. In welcher Reihenfolge?`;solution=rotated.join(' → ');hint=`Zuerst ${w}, zuletzt ${z}; die mittleren zwei sind festgelegt.`;}
 else if(type===1){title='Gleichgewicht';const n=2+set, m=1+shift;prompt=`Die Waage zeigt: ${w} wiegt ${n} Einheiten, ${x} wiegt ${m} mehr als ${w}, ${y} doppelt so viel wie ${x}. Wie viel wiegen alle drei zusammen?`;solution=String(n+3*(n+m));hint=`${x} wiegt ${n+m}. Addiere die drei Gewichte.`;}
 else{title='Wächterinschrift';prompt=`Genau eine Rune öffnet das Tor: ${seq.join(', ')}. Sie ist weder ${w} noch ${x}. ${z} ist mit einem roten Strich als falsch markiert. Welche Rune bleibt?`;solution=y;hint=`Streiche die drei ausdrücklich ausgeschlossenen Runen.`;}
 puzzles.push({id:puzzles.length+1,title:`${title} – ${set+1}.${shift+1}`,prompt,solution,hint,skill:'Investigation',dc:12+type,gm:'Lass die Gruppe die Antwort eingeben oder aussprechen. Bei Erfolg öffnet sich der vom GM bestimmte Zugang; bei Fehler darf erneut versucht werden.'});
}
export const PUZZLES=Object.freeze(puzzles);
export const puzzleById=id=>PUZZLES.find(p=>p.id===id);
