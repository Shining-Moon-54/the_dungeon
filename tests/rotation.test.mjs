/**
 * Tests: Karten-Rotation (prefabs.mjs, karteRotieren).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { KARTEN, karteParsen, karteRotieren } from "../scripts/prefabs.mjs";

test("Rotation: 4 x 90° ergibt das Original (alle Karten, alle Themen)", () => {
  for (const [thema, defs] of Object.entries(KARTEN)) {
    for (const def of defs) {
      const k = karteParsen(def, thema);
      let r = k;
      for (let i = 0; i < 4; i++) r = karteRotieren(r, 1);
      assert.equal(r.grid.join("/"), k.grid.join("/"), `${thema}/${def.id}`);
      assert.equal(r.breite, k.breite);
      assert.equal(r.hoehe, k.hoehe);
    }
  }
});

test("Rotation: 90° getauschte Dimensionen, gleiche Bodenfläche", () => {
  for (const [thema, defs] of Object.entries(KARTEN)) {
    for (const def of defs) {
      const k = karteParsen(def, thema);
      const flaeche = (kk) =>
        kk.grid.join("").split("").filter((c) => c !== "#").length;
      for (const rot of [1, 2, 3]) {
        const r = karteRotieren(k, rot);
        assert.equal(flaeche(r), flaeche(k), `${thema}/${def.id} rot ${rot}`);
      }
      const r90 = karteRotieren(k, 1);
      assert.equal(r90.breite, k.hoehe);
      assert.equal(r90.hoehe, k.breite);
    }
  }
});

test("Rotation: Türen bleiben am Rand und wechseln die Seite korrekt", () => {
  // Testkarte: Tür 'n' oben, Breite 5, Höhe 3.
  const k = karteParsen(
    { id: "r", grid: ["##n##", "#...#", "#...#"] },
    "katakombe"
  );
  // 90° im Uhrzeigersinn: (x,y) -> (H-1-y, x) – Nord-Tür (2,0)
  // landet bei (H-1-0=2, x=2) = Zeile 2, Spalte 2, Seite 'o'.
  const r90 = karteRotieren(k, 1);
  assert.equal(r90.breite, 3);
  assert.equal(r90.hoehe, 5);
  assert.equal(r90.grid[2][2], "o", "Nord-Tür sollte nach Ost wandern");
  // 180°: Tür unten, Seite 's'.
  const r180 = karteRotieren(k, 2);
  assert.equal(r180.grid[2][2], "s");
  // 270°: Tür links, Seite 'w'.
  const r270 = karteRotieren(k, 3);
  assert.equal(r270.grid[2][0], "w");
});

test("Rotation: Marker wandern mit (Position stimmt)", () => {
  const k = karteParsen(
    { id: "m", grid: ["##n##", "#.E.#", "#####"] },
    "katakombe"
  );
  // E bei lokal (2,1). 90° im Uhrzeigersinn (x,y)->(H-1-y,x): Ziel (1,2).
  const r90 = karteRotieren(k, 1);
  assert.equal(r90.grid[2][1], "E");
  // 180° (x,y)->(B-1-x,H-1-y): Ziel (2,1).
  const r180 = karteRotieren(k, 2);
  assert.equal(r180.grid[1][2], "E");
  // 270° (x,y)->(y,B-1-x): Ziel (1,2) von rechts: (2, 5-1-2=2).
  const r270 = karteRotieren(k, 3);
  assert.equal(r270.grid[2][1], "E");
});

test("Rotation: rot=0 unverändert, rot wird mod 4 normalisiert", () => {
  const k = karteParsen(KARTEN.katakombe[0], "katakombe");
  assert.equal(karteRotieren(k, 0), k);
  assert.equal(karteRotieren(k, 4).grid.join("/"), k.grid.join("/"));
  assert.equal(karteRotieren(k, 5).grid.join("/"), karteRotieren(k, 1).grid.join("/"));
});