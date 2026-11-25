/**
 * THE DUNGEON – Tests: Persistenz v2 (M2-Felder).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import { dungeonAnlegen, DEFAULT_LIMITS } from "../scripts/generator.mjs";
import { sanktumAnlegen, savePointRegistrieren, savePointSperren } from "../scripts/sanctuary.mjs";
import {
  zustandSerialisieren,
  zustandDeserialisieren,
} from "../scripts/persistenz.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8, maxEbenen: 6 };

test("Persistenz v2: M2-Felder wandern mit (Verbindungen, SavePoints, Sanktue)", () => {
  const dungeon = dungeonAnlegen("katakombe", "v2", LIMITS);
  dungeon.verbindungen = [];
  dungeon.savePoints = [];
  dungeon.sanktue = [];
  dungeon.ausloeser = "bestaetigung";
  dungeon.oberwelt = { szenenId: "taverne", x: 100, y: 200 };
  dungeon.szenenIds = { 1: "scene-1" };

  const rng = new Rng("v2-rng");
  // Sanktum + Save Point erzeugen:
  const s = sanktumAnlegen(dungeon, rng);
  const marker = s.karten ? null : null; // Marker via levels, hier egal
  void marker;
  const ebene1 = dungeon.ebenen[0];
  const eingang = ebene1.karten.values().next().value;
  savePointRegistrieren(
    dungeon,
    ebene1,
    { placementId: eingang.id, index: 0, x: 0, y: 0 },
    "Start"
  );
  dungeon.verbindungen.push({
    id: "v1",
    von: { ebeneNr: 1, placementId: "k1", index: 0 },
    nach: { ebeneNr: 2, placementId: "k1", index: 0 },
    art: "treppe",
  });

  const payload = zustandSerialisieren(dungeon, rng);
  assert.equal(payload.version, 2);
  assert.equal(payload.ausloeser, "bestaetigung");
  assert.equal(payload.oberwelt.szenenId, "taverne");
  assert.equal(payload.szenenIds[1], "scene-1");
  assert.equal(payload.verbindungen.length, 1);
  assert.equal(payload.savePoints.length, 1);
  assert.ok(payload.sanktue.includes(s.nr));

  const { dungeon: d2, rng: r2 } = zustandDeserialisieren(payload);
  assert.equal(d2.verbindungen.length, 1);
  assert.equal(d2.savePoints.length, 1);
  assert.equal(d2.ausloeser, "bestaetigung");
  assert.equal(d2.oberwelt.szenenId, "taverne");
  assert.deepEqual(d2.sanktue, dungeon.sanktue);
  // Ebenen-Struktur bleibt funktional:
  assert.ok(d2.ebenen[0].karten instanceof Map);
  // RNG läuft weiter wie das Original:
  assert.equal(r2.float(), rng.float());
});

test("Persistenz v2: Sperrstatus der Save Points überlebt", () => {
  const dungeon = dungeonAnlegen("hoehle", "sperre", LIMITS);
  dungeon.savePoints = [];
  const rng = new Rng("sperre");
  const ebene = dungeon.ebenen[0];
  const p = savePointRegistrieren(
    dungeon, ebene,
    { placementId: "k1", index: 0, x: 0, y: 0 },
    "SP"
  );
  savePointSperren(dungeon, p.id, true);

  const payload = zustandSerialisieren(dungeon, rng);
  const { dungeon: d2 } = zustandDeserialisieren(payload);
  assert.equal(d2.savePoints[0].gesperrt, true, "Sperrstatus verloren");
});

test("Persistenz v2: v1-Payload wird abwärtskompatibel gelesen", () => {
  const dungeon = dungeonAnlegen("katakombe", "v1", LIMITS);
  const rng = new Rng("v1");
  // v1-Payload simulieren (ohne M2-Felder):
  const { zustandSerialisieren: v1ser } = await_importSB();
  const v1 = { ...v1ser(dungeon, rng), version: 1 };
  const { dungeon: d2 } = zustandDeserialisieren(v1);
  assert.equal(d2.verbindungen.length, 0);
  assert.equal(d2.savePoints.length, 0);
  assert.deepEqual(d2.sanktue, []);
});

test("Persistenz v2: unbekannte Version wird abgelehnt", () => {
  assert.throws(() => zustandDeserialisieren({ version: 99 }), /Unbekannter Zustand/);
  assert.throws(() => zustandDeserialisieren(null), /Unbekannter Zustand/);
});

/** Import-Broker (kein doppelter statischer Import). */
function await_importSB() {
  return _sb;
}
const _sb = await import("../scripts/scene-builder.mjs");