/**
 * THE DUNGEON – Testumgebung & Integrationstests (v2).
 *
 * Bestandteile (Anforderung „Testumgebung"):
 *   1. Alle vier Umgebungsthemen (katakombe, hoehle, turm, stadt).
 *   2. Mindestens 1.000 unterschiedliche Seeds automatisiert geprüft
 *      (tests/massen.test.mjs – 1.040 Dungeons).
 *   3. Fehlererkennung: Überlappungen, unerreichbare Räume,
 *      fehlerhafte Türen, Größenüberschreitungen (massen.test.mjs).
 *   4. Foundry-v14-Integrationstests (tests/foundry-integration.test.mjs,
 *      läuft NUR wenn `game` existiert – im CI ohne Foundry deaktiviert).
 *   5. Screenshots generierter Dungeons (tools/render-dungeon.mjs +
 *      tests/visual/*.svg).
 *   6. Performance: Messungen hier (Karten/Sekunde) mit groben
 *      Richtwerten für leistungsschwache Hardware.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  naechsterZug,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";
import { verbindungOeffnen, markerDerEbene } from "../scripts/levels.mjs";
import { sanktumAnlegen } from "../scripts/sanctuary.mjs";
import { zustandSerialisieren, zustandDeserialisieren } from "../scripts/persistenz.mjs";

const THEMEN = ["katakombe", "hoehle", "turm", "stadt"];

test("Integration: alle vier Themen generieren ebene + sanktum + treppen", () => {
  for (const thema of THEMEN) {
    const dungeon = dungeonAnlegen(thema, `integration-${thema}`, {
      ...DEFAULT_LIMITS,
      maxKartenProEbene: 8,
      maxEbenen: 4,
    });
    dungeon.verbindungen = [];
    dungeon.savePoints = [];
    dungeon.sanktue = [];
    const rng = new Rng(`integration-${thema}`);
    const ebene = dungeon.ebenen[0];

    // Ebene füllen …
    for (let i = 0; i < 50; i++) if (naechsterZug(ebene, rng, dungeon.limits) === null) break;

    // … Treppe öffnen (falls vorhanden) …
    const treppen = markerDerEbene(ebene, "treppe");
    if (treppen.length > 0) {
      const ergebnis = verbindungOeffnen(dungeon, ebene, treppen[0], rng);
      assert.ok(ergebnis.verbindung, `${thema}: Verbindung fehlt`);
      assert.equal(ergebnis.zielEbene.nr, 2, `${thema}: Zielebene != 2`);
    }

    // … Sanktum anlegen.
    const sanktum = sanktumAnlegen(dungeon, rng);
    assert.equal(sanktum.typ, "sanctuary");
    assert.equal(markerDerEbene(sanktum, "gegner").length, 0, `${thema}: Sanktum nicht leer`);

    // Persistenz-Runde:
    const payload = zustandSerialisieren(dungeon, rng);
    const { dungeon: d2 } = zustandDeserialisieren(payload);
    assert.equal(d2.ebenen.length, dungeon.ebenen.length, `${thema}: Ebenen verloren`);
  }
});

test("Integration: Statistik über alle Themen (Sanity)", () => {
  const stats = {};
  for (const thema of THEMEN) {
    let karten = 0;
    let dungeons = 0;
    for (let i = 0; i < 25; i++) {
      const dungeon = dungeonAnlegen(thema, `stat-${i}`, DEFAULT_LIMITS);
      dungeon.verbindungen = [];
      const rng = new Rng(`stat-${i}`);
      ebeneGenerieren(dungeon.ebenen[0], dungeon.limits);
      karten += dungeon.ebenen[0].karten.size;
      dungeons++;
    }
    stats[thema] = { karten, dungeons, schnitt: karten / dungeons };
    // Sanity: mind. Startkarte + 1, max. Limit.
    assert.ok(stats[thema].schnitt > 1, `${thema}: zu wenig Karten im Schnitt`);
    assert.ok(
      karten <= dungeons * DEFAULT_LIMITS.maxKartenProEbene,
      `${thema}: Limit verletzt`
    );
  }
});

test("Performance: 1.000 Dungeon-Generierungen unter Richtzeit", { timeout: 300000 }, () => {
  const t0 = Date.now();
  let kartenGesamt = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const thema = THEMEN[i % THEMEN.length];
    const dungeon = dungeonAnlegen(thema, `perf-${i}`, {
      ...DEFAULT_LIMITS,
      maxKartenProEbene: 10,
    });
    dungeon.verbindungen = [];
    const rng = new Rng(`perf-${i}`);
    const ebene = dungeon.ebenen[0];
    for (let k = 0; k < 60; k++) if (naechsterZug(ebene, rng, dungeon.limits) === null) break;
    kartenGesamt += ebene.karten.size;
  }
  const dauer = Date.now() - t0;
  const proDungeon = dauer / N;
  // Richtwert: leistungsschwache Hardware. Der Generator ist reine
  // Logik – 10 ms pro Dungeon (inkl. ~8 Karten) sollte selbst auf
  // alten Rechnern locker gegeben sein (v14-Szenen-DOM folgt separat).
  assert.ok(
    proDungeon < 10,
    `zu langsam: ${proDungeon.toFixed(2)} ms/Dungeon (${kartenGesamt} Karten)`
  );
  console.log(
    `Performance: ${N} Dungeons, ${kartenGesamt} Karten in ${dauer} ms (${proDungeon.toFixed(2)} ms/Dungeon)`
  );
});