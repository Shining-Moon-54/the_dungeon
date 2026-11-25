/**
 * Tests: Karten-Deck (prefabs.mjs).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZEICHEN,
  THEMEN,
  KARTEN,
  karteParsen,
  deckLaden,
  karteKanten,
  tuerKante,
  gegenSeite,
} from "../scripts/prefabs.mjs";

/** Alle Karten aller Themen sind gültig (Strukturfehler früh entdecken). */
test("Prefabs: alle Karten aller Themen parsen und validieren", () => {
  for (const thema of Object.keys(THEMEN)) {
    const deck = deckLaden(thema);
    assert.ok(deck.size > 0, `Thema ${thema} hat keine Karten`);
    for (const karte of deck.values()) {
      assert.ok(karte.breite > 0 && karte.hoehe > 0);
      assert.ok(karte.tueren.length > 0, `Karte ${karte.id} ohne Tür`);
    }
  }
});

test("Prefabs: jede Karte besitzt eine Eingangskarte je Thema", () => {
  for (const thema of Object.keys(KARTEN)) {
    const eingaenge = KARTEN[thema].filter((k) => k.kategorie === "eingang");
    assert.equal(eingaenge.length, 1, `Thema ${thema}: ${eingaenge.length} Eingangskarten`);
  }
});

test("Prefabs: ungültiges Grid wirft KartenFehler", () => {
  assert.throws(() => karteParsen({ id: "bad", grid: [] }, "katakombe"), /leeres Grid/);
  assert.throws(
    () => karteParsen({ id: "bad", grid: ["#..", "#."] }, "katakombe"),
    /Länge/
  );
  assert.throws(
    () => karteParsen({ id: "bad", grid: ["#x#"] }, "katakombe"),
    /unbekanntes Zeichen/
  );
  // Tür nicht am Rand.
  assert.throws(
    () => karteParsen({ id: "bad", grid: ["####", "#n.#", "####"] }, "katakombe"),
    /nicht am Kartenrand/
  );
});

test("Prefabs: Marker werden erkannt", () => {
  const karte = karteParsen(
    { id: "m", grid: ["###n####", "#..E.Kg#", "########"] },
    "katakombe"
  );
  const arten = karte.marker.map((m) => m.art).sort();
  assert.deepEqual(arten, ["eingang", "gegner", "truhe"]);
});

test("Prefabs: Kanten – Fels erzeugt Wände, Boden-Innenraum keine", () => {
  const karte = karteParsen(
    { id: "w", grid: ["##n##", "#...#", "#...#", "##s##"] },
    "katakombe"
  );
  const { waende } = karteKanten(karte);
  // Plus-Form (8 Boden-Zellen): 12 Rand-Kanten sind Wände, 2 sind Türen.
  assert.equal(waende.size, 12, `erwartet 12 Wände, gefunden ${waende.size}`);
  // Keine Kante mitten im Raum (Zelle (2,1) komplett von Boden umgeben).
  assert.equal(waende.has("2,1,h"), false);
  assert.equal(waende.has("2,1,v"), false);
});

test("Prefabs: Kanten – Tür ersetzt Wand am Rand", () => {
  const karte = karteParsen(
    { id: "t", grid: ["##n##", "#...#", "#...#", "##s##"] },
    "katakombe"
  );
  const { waende, tueren } = karteKanten(karte);
  assert.ok(tueren.has("2,0,h"), "Nord-Tür fehlt");
  // Süd-Kante der Zelle (2,3) = obere Kante von (2,4).
  assert.ok(tueren.has("2,4,h"), "Süd-Tür fehlt");
  assert.ok(!waende.has("2,0,h"), "Nord-Tür überschreibt Wand nicht");
  // Linke Wand der Zelle (1,1), rechte = linke Kante von (4,1).
  assert.ok(waende.has("1,1,v"), "linke Seitenwand fehlt");
  assert.ok(waende.has("4,1,v"), "rechte Seitenwand fehlt");
});

test("Prefabs: tuerKante bildet alle vier Seiten korrekt ab", () => {
  const placement = { x: 10, y: 20, karteBreite: 5, karteHoehe: 4 };
  assert.deepEqual(tuerKante(placement, { cx: 2, cy: 0, seite: "n" }), { x: 12, y: 20, seite: "h" });
  assert.deepEqual(tuerKante(placement, { cx: 2, cy: 3, seite: "s" }), { x: 12, y: 24, seite: "h" });
  assert.deepEqual(tuerKante(placement, { cx: 0, cy: 1, seite: "w" }), { x: 10, y: 21, seite: "v" });
  assert.deepEqual(tuerKante(placement, { cx: 4, cy: 1, seite: "o" }), { x: 15, y: 21, seite: "v" });
});

test("Prefabs: gegenSeite bildet Paare", () => {
  assert.equal(gegenSeite("n"), "s");
  assert.equal(gegenSeite("s"), "n");
  assert.equal(gegenSeite("w"), "o");
  assert.equal(gegenSeite("o"), "w");
});