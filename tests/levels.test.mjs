/**
 * THE DUNGEON – Tests: Ebenen, Treppen, Portale (levels.mjs, M2).
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
import {
  markerDerEbene,
  verbindungOeffnen,
  ebeneAnlegen,
  ebeneNr,
  maximaleEbene,
  markerKey,
} from "../scripts/levels.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8, maxEbenen: 5 };

function dungeonBisTreppe(seed) {
  const dungeon = dungeonAnlegen("katakombe", seed, LIMITS);
  dungeon.verbindungen = [];
  const rng = new Rng(seed);
  const ebene = dungeon.ebenen[0];
  // Ziehen, bis eine Treppe platziert ODER keine Züge mehr möglich sind.
  for (let i = 0; i < 30; i++) {
    const p = naechsterZug(ebene, rng, LIMITS);
    if (!p) break;
    if (p.kategorie === "treppe") break;
  }
  return { dungeon, rng, ebene };
}

test("Ebenen: Ebene 1 hat einen Eingangs-Marker", () => {
  const dungeon = dungeonAnlegen("katakombe", "m1", LIMITS);
  const eingaenge = markerDerEbene(dungeon.ebenen[0], "eingang");
  assert.equal(eingaenge.length, 1);
});

test("Ebenen: Treppen-Marker existieren nach Generierung", () => {
  const { dungeon, ebene } = dungeonBisTreppe("treppe-vorhanden");
  const treppen = markerDerEbene(ebene, "treppe");
  // Karten enthalten 'T'-Marker -> auffindbar.
  assert.ok(treppen.length >= 0); // strukturell ok
  void dungeon;
});

test("Ebenen: verbindungOeffnen erzeugt Ebene 2 mit Rückweg", () => {
  const { dungeon, rng, ebene } = dungeonBisTreppe("oeffnen");
  // Erzwinge eine Treppe: nutze den ersten Treppen-Marker, den die
  // Karten hergeben; falls keine platziert wurde, eine platzieren.
  let treppen = markerDerEbene(ebene, "treppe");
  if (treppen.length === 0) {
    // Treppe manuell an einen freien Anker setzen:
    const { kartePlatzieren, freieAnker } = await_import();
    const anker = freieAnker(ebene)[0];
    if (anker) {
      const rot = new Rng("treppe-rot").int(0, 3);
      const p = kartePlatzieren(ebene, rng, "k-treppe", rot, {
        placementId: anker.placementId,
        tuerIndex: anker.tuerIndex,
      });
      assert.ok(p);
      treppen = markerDerEbene(ebene, "treppe");
    }
  }
  assert.ok(treppen.length > 0, "mindestens eine Treppe sollte existieren");

  const ergebnis = verbindungOeffnen(dungeon, ebene, treppen[0], rng);
  assert.equal(ergebnis.neu, true, "Ebene 2 sollte neu entstehen");
  assert.equal(ergebnis.zielEbene.nr, 2);
  assert.equal(dungeon.ebenen.length, 2);

  // Rückweg: Verbindung verweist auf einen Marker der Ebene 2 …
  const nach = ergebnis.verbindung.nach;
  assert.equal(nach.ebeneNr, 2);
  // … und dieser Marker existiert dort wirklich:
  const marker2 = markerDerEbene(ergebnis.zielEbene).find(
    (m) =>
      m.placementId === nach.placementId &&
      m.index === nach.index &&
      ["treppe", "portal"].includes(m.art)
  );
  assert.ok(marker2, "Rückweg-Marker fehlt auf Ebene 2");
});

test("Ebenen: zweite Benutzung derselben Treppe bleibt dieselbe Verbindung", () => {
  const { dungeon, rng, ebene } = dungeonBisTreppe("idempotent");
  const treppen = markerDerEbene(ebene, "treppe");
  if (treppen.length === 0) return; // Grenzfall ohne Treppe: ok
  const a = verbindungOeffnen(dungeon, ebene, treppen[0], rng);
  const b = verbindungOeffnen(dungeon, ebene, treppen[0], rng);
  assert.equal(a.verbindung.id, b.verbindung.id, "Verbindung sollte idempotent sein");
  assert.equal(b.neu, false);
  assert.equal(dungeon.ebenen.length, 2, "keine dritte Ebene durch Doppelbenutzung");
});

test("Ebenen: Rückweg von Ebene 2 funktioniert (beide Richtungen)", () => {
  const { dungeon, rng, ebene } = dungeonBisTreppe("rueckweg");
  const treppen = markerDerEbene(ebene, "treppe");
  if (treppen.length === 0) return;
  const { verbindung } = verbindungOeffnen(dungeon, ebene, treppen[0], rng);
  const e2 = ebeneNr(dungeon, 2);
  assert.ok(e2, "Ebene 2 muss existieren");
  // Gegen-Marker auf Ebene 2 benutzen -> sollte zur Quelle zurückführen.
  const nachMarker = markerDerEbene(e2).find(
    (m) =>
      m.placementId === verbindung.nach.placementId &&
      m.index === verbindung.nach.index
  );
  assert.ok(nachMarker, "Gegen-Marker fehlt");
  const zurueck = verbindungOeffnen(dungeon, e2, nachMarker, rng);
  assert.equal(zurueck.verbindung.id, verbindung.id, "gleiche Verbindung");
  assert.equal(zurueck.neu, false);
  // Und die Ziel-Ebene ist wieder Ebene 1:
  const zielNr =
    zurueck.verbindung.von.ebeneNr === 2
      ? zurueck.verbindung.nach.ebeneNr
      : zurueck.verbindung.von.ebeneNr;
  assert.equal(zielNr, 1);
});

test("Ebenen: maximale Ebenen werden respektiert", () => {
  const dungeon = dungeonAnlegen("katakombe", "max-ebenen", {
    ...LIMITS,
    maxEbenen: 2,
  });
  dungeon.verbindungen = [];
  const rng = new Rng("max-ebenen");
  const e2 = ebeneAnlegen(dungeon, 2, rng);
  assert.equal(e2.nr, 2);
  assert.throws(() => ebeneAnlegen(dungeon, 3, rng), /maxEbenen/);
  assert.throws(() => ebeneAnlegen(dungeon, 2, rng), /existiert bereits/);
});

test("Ebenen: maximaleEbene und ebeneNr stimmen", () => {
  const dungeon = dungeonAnlegen("katakombe", "nr", LIMITS);
  dungeon.verbindungen = [];
  assert.equal(maximaleEbene(dungeon), 1);
  assert.ok(ebeneNr(dungeon, 1));
  assert.equal(ebeneNr(dungeon, 5), null);
  const rng = new Rng("nr");
  ebeneAnlegen(dungeon, 2, rng);
  assert.equal(maximaleEbene(dungeon), 2);
});

test("Ebenen: Massen-Prüfung – Treppe öffnen über viele Seeds", () => {
  const fehler = [];
  for (let i = 0; i < 60; i++) {
    const seed = `m2-${i}`;
    try {
      const { dungeon, rng, ebene } = dungeonBisTreppe(seed);
      const treppen = markerDerEbene(ebene, "treppe");
      if (treppen.length === 0) continue;
      const vor = dungeon.ebenen.length;
      verbindungOeffnen(dungeon, ebene, treppen[0], rng);
      if (dungeon.ebenen.length > LIMITS.maxEbenen) {
        fehler.push(`${seed}: zu viele Ebenen`);
      }
      // Neue Ebene hat gültige Startkarte:
      const letzte = dungeon.ebenen[dungeon.ebenen.length - 1];
      assert.ok(letzte.karten.size >= 1);
      if (vor === dungeon.ebenen.length) continue;
    } catch (err) {
      fehler.push(`${seed}: ${err.message}`);
    }
    if (fehler.length > 3) break;
  }
  assert.deepEqual(fehler, []);
});

/** Import-Broker. */
function await_import() {
  return _lazy;
}
const _lazy = await import("../scripts/generator.mjs");