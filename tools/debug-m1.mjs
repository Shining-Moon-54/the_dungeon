import { Rng } from "../scripts/rng.mjs";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  karteHolen,
  naechsterZug,
  freieAnker,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";
import { karteKanten } from "../scripts/prefabs.mjs";

// 1) Wand-Anzahl der Plus-Form inspecten.
import { karteParsen } from "../scripts/prefabs.mjs";
const karte = karteParsen(
  { id: "dbg", grid: ["##n##", "#...#", "#...#", "##s##"] },
  "katakombe"
);
const kanten = karteKanten(karte);
console.log("Wände:", [...kanten.waende.keys()].sort());
console.log("Türen:", [...kanten.tueren.keys()].sort());

// 2) naechsterZug mit Seed 'limit' verfolgen.
const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8 };
const dungeon = dungeonAnlegen("katakombe", "limit", LIMITS);
const ebene = dungeon.ebenen[0];
const rng = new Rng(ebene.seed);
console.log("\nStartkarte:", [...ebene.karten.values()].map((p) => `${p.id}:${p.karte}@${p.x},${p.y}`));
console.log("Anker:", freieAnker(ebene).map((a) => `${a.id} seite=${a.seite} frei=${a.frei}`));
for (let i = 0; i < 5; i++) {
  const p = naechsterZug(ebene, rng, LIMITS);
  console.log(`Zug ${i + 1}:`, p ? `${p.id}:${p.karte}@${p.x},${p.y}` : "null");
}

// 3) Kollisionstest nachvollziehen.
const start = [...ebene.karten.values()][0];
const gleicheKarte = karteHolen("katakombe", start.karte);
import { kollidiert } from "../scripts/generator.mjs";
console.log("\nKollision an Startposition:", kollidiert(ebene, gleicheKarte, start.x, start.y));
console.log("Boden der Startkarte:", JSON.stringify(start));