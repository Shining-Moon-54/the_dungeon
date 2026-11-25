/**
 * THE DUNGEON – Tests: Sanktuen & Save Points (sanctuary.mjs, M2).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import { dungeonAnlegen, DEFAULT_LIMITS } from "../scripts/generator.mjs";
import {
  markerDerEbene,
  verbindungOeffnen,
} from "../scripts/levels.mjs";
import {
  sanktumAnlegen,
  sanktue,
  sanktumAlsSavePoint,
  savePointRegistrieren,
  savePointSperren,
  verfuegbareSavePoints,
  teleportZiel,
  rueckkehrZiel,
} from "../scripts/sanctuary.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8, maxEbenen: 6 };

function basisDungeon(seed) {
  const dungeon = dungeonAnlegen("katakombe", seed, LIMITS);
  dungeon.verbindungen = [];
  dungeon.savePoints = [];
  dungeon.sanktue = [];
  return dungeon;
}

test("Sanktum: anlegen erzeugt eine sanctuary-Ebene", () => {
  const dungeon = basisDungeon("sanktum");
  const rng = new Rng("sanktum");
  const s = sanktumAnlegen(dungeon, rng);
  assert.equal(s.typ, "sanctuary");
  assert.ok(sanktue(dungeon).some((e) => e.nr === s.nr));
  // Sanktum ist leer: keine Gegner-Marker.
  const gegner = [
    ...markerDerEbene(s, "gegner"),
    ...markerDerEbene(s, "gegner-elite"),
  ];
  assert.equal(gegner.length, 0, "Sanktum muss gegnerfrei sein");
});

test("Save Points: registrieren ist idempotent", () => {
  const dungeon = basisDungeon("sp");
  const ebene = dungeon.ebenen[0];
  const marker = markerDerEbene(ebene, "eingang")[0];
  const a = savePointRegistrieren(dungeon, ebene, marker, "Start");
  const b = savePointRegistrieren(dungeon, ebene, marker, "Nochmal");
  assert.equal(a.id, b.id, "gleicher Save Point, kein Doppel");
  assert.equal(dungeon.savePoints.length, 1);
});

test("Save Points: Sperren wirkt auf Spieler, nicht auf GM", () => {
  const dungeon = basisDungeon("sperren");
  const ebene = dungeon.ebenen[0];
  const marker = markerDerEbene(ebene, "eingang")[0];
  const p = savePointRegistrieren(dungeon, ebene, marker, "Start");
  assert.equal(verfuegbareSavePoints(dungeon, true).length, 1);
  assert.equal(verfuegbareSavePoints(dungeon, false).length, 1);
  savePointSperren(dungeon, p.id, true);
  assert.equal(verfuegbareSavePoints(dungeon, false).length, 0, "gesperrt für Spieler");
  assert.equal(verfuegbareSavePoints(dungeon, true).length, 1, "GM sieht alle");
  savePointSperren(dungeon, p.id, false);
  assert.equal(verfuegbareSavePoints(dungeon, false).length, 1);
});

test("Save Points: Teleport-Ziel auflösen", () => {
  const dungeon = basisDungeon("teleport");
  const ebene = dungeon.ebenen[0];
  const marker = markerDerEbene(ebene, "eingang")[0];
  const p = savePointRegistrieren(dungeon, ebene, marker, "Eingang");
  const ziel = teleportZiel(dungeon, p.id);
  assert.ok(ziel, "Ziel muss auflösbar sein");
  assert.equal(ziel.ebene.nr, 1);
  assert.equal(teleportZiel(dungeon, "gibts-nicht"), null);
});

test("Sanktum: automatische Save-Point-Registrierung beim Betreten", () => {
  const dungeon = basisDungeon("sanctuary-sp");
  const rng = new Rng("sanctuary-sp");
  const s = sanktumAnlegen(dungeon, rng);
  const sp = sanktumAlsSavePoint(dungeon, s, "Raststätte");
  assert.ok(sp, "Sanktum sollte als Save Point registriert werden");
  assert.equal(dungeon.savePoints.length, 1);
});

test("Rückkehr: Oberwelt konfigurierbar", () => {
  const dungeon = basisDungeon("oberwelt");
  // Ohne Konfiguration: kein Rückkehr-Ziel.
  assert.equal(rueckkehrZiel(dungeon), null);
  dungeon.oberwelt = { szenenId: "scene-taverne", x: 1500, y: 800 };
  const ziel = rueckkehrZiel(dungeon);
  assert.ok(ziel);
  assert.equal(ziel.szenenId, "scene-taverne");
  assert.equal(ziel.x, 1500);
  assert.equal(ziel.y, 800);
});

test("Sanktum: Massen-Prüfung über Seeds", () => {
  const fehler = [];
  for (let i = 0; i < 40; i++) {
    try {
      const dungeon = basisDungeon(`sanktum-${i}`);
      const rng = new Rng(`sanktum-${i}`);
      const s = sanktumAnlegen(dungeon, rng);
      assert.equal(s.typ, "sanctuary");
      assert.equal(markerDerEbene(s, "gegner").length, 0);
      const sp = sanktumAlsSavePoint(dungeon, s);
      assert.ok(sp);
      // Verbindung vom Sanktum in die nächste Ebene funktioniert:
      const treppen = markerDerEbene(s, "treppe");
      if (treppen.length > 0) {
        verbindungOeffnen(dungeon, s, treppen[0], rng);
      }
    } catch (err) {
      fehler.push(`sanktum-${i}: ${err.message}`);
    }
    if (fehler.length > 3) break;
  }
  assert.deepEqual(fehler, []);
});