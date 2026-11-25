/**
 * Tests: Graph-Generator (generator.mjs, v2).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  kartePlatzieren,
  karteHolen,
  naechsterZug,
  freieAnker,
  kollidiert,
  kartePlacement,
  ausdehnung,
  platzierungErlaubt,
  nichtErweiterbareAbschliessen,
  dungeonId,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8 };

test("Generator: dungeonAnlegen erzeugt Ebene 1 mit (rotierter) Startkarte", () => {
  const dungeon = dungeonAnlegen("katakombe", "seed-1", LIMITS);
  assert.equal(dungeon.ebenen.length, 1);
  assert.ok(dungeon.id, "Dungeon braucht eine eindeutige Id");
  const ebene = dungeon.ebenen[0];
  assert.equal(ebene.karten.size, 1);
  const start = [...ebene.karten.values()][0];
  assert.equal(start.kategorie, "eingang");
  assert.ok(ebene.anker.size > 0, "Startkarte sollte freie Anker haben");
});

test("Generator: Dungeon-Ids sind eindeutig", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(dungeonId());
  assert.equal(ids.size, 100);
});

test("Generator: gleicher Seed erzeugt identischen Dungeon (statisch)", () => {
  const dump = (d) =>
    [...d.ebenen[0].karten.values()]
      .map((p) => `${p.id}:${p.karte}@${p.x},${p.y} rot=${p.rot}`)
      .sort();
  const a = dungeonAnlegen("katakombe", "repro", LIMITS);
  const b = dungeonAnlegen("katakombe", "repro", LIMITS);
  ebeneGenerieren(a.ebenen[0], LIMITS);
  ebeneGenerieren(b.ebenen[0], LIMITS);
  assert.deepEqual(dump(a), dump(b));
});

test("Generator: ebeneGenerieren respektiert maxKartenProEbene", () => {
  const dungeon = dungeonAnlegen("katakombe", "limit", LIMITS);
  const platziert = ebeneGenerieren(dungeon.ebenen[0], LIMITS);
  assert.ok(
    dungeon.ebenen[0].karten.size <= LIMITS.maxKartenProEbene,
    `Limit überschritten: ${dungeon.ebenen[0].karten.size}`
  );
  assert.ok(platziert > 0, "es sollte mindestens eine Karte gezogen werden");
});

test("Generator: Rotation – jede platzierte Karte ist korrekt rotiert gespeichert", () => {
  const dungeon = dungeonAnlegen("katakombe", "rot-check", LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, LIMITS);
  for (const p of ebene.karten.values()) {
    const rk = kartePlacement(ebene, p);
    const basis = karteHolen("katakombe", p.karte);
    assert.ok(rk && basis, "Karten auflösbar");
    // Türen des Placements entsprechen der rotierten Karte.
    assert.equal(p.tueren.length, rk.tueren.length);
    // Dimensionen.
    assert.equal(p.karteBreite, rk.breite);
    assert.equal(p.karteHoehe, rk.hoehe);
  }
});

test("Generator: jede platzierte Karte dockt an einer freien Tür an", () => {
  const dungeon = dungeonAnlegen("katakombe", "andock", LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, LIMITS);
  for (const placement of ebene.karten.values()) {
    if (placement.kategorie === "eingang") continue;
    const verbunden = placement.tueren.some((t) => t.ziel !== null);
    assert.ok(
      verbunden,
      `Karte ${placement.id} (${placement.karte} rot ${placement.rot}) ist nicht verbunden`
    );
  }
});

test("Generator: verbundene Türen sind wechselseitig verknüpft", () => {
  const dungeon = dungeonAnlegen("katakombe", "link", LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, LIMITS);
  for (const placement of ebene.karten.values()) {
    placement.tueren.forEach((t, i) => {
      if (!t.ziel) return;
      const gegen = ebene.karten.get(t.ziel.placementId);
      assert.ok(gegen, `Ziel-Placement ${t.ziel.placementId} fehlt`);
      const gegenTuer = gegen.tueren[t.ziel.tuerIndex];
      assert.deepEqual(
        gegenTuer.ziel,
        { placementId: placement.id, tuerIndex: i },
        `Rückverbindung fehlt: ${placement.id}:${i}`
      );
    });
  }
});

test("Generator: angedockte Tür-Kanten fallen exakt aufeinander", () => {
  const dungeon = dungeonAnlegen("katakombe", "kanten", LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, LIMITS);
  const kantenKey = (placement, tuer) => {
    const x = placement.x + tuer.cx;
    const y = placement.y + tuer.cy;
    if (tuer.seite === "n") return `${x},${y},h`;
    if (tuer.seite === "s") return `${x},${y + 1},h`;
    if (tuer.seite === "w") return `${x},${y},v`;
    return `${x + 1},${y},v`;
  };
  for (const placement of ebene.karten.values()) {
    const karte = kartePlacement(ebene, placement);
    karte.tueren.forEach((t, i) => {
      const t1 = placement.tueren[i];
      if (!t1.ziel) return;
      const gegen = ebene.karten.get(t1.ziel.placementId);
      const gegenKarte = kartePlacement(ebene, gegen);
      const gegenTuer = gegenKarte.tueren[t1.ziel.tuerIndex];
      assert.equal(
        kantenKey(placement, t),
        kantenKey(gegen, gegenTuer),
        "Tür-Kanten sollten identisch sein"
      );
    });
  }
});

test("Generator: kollidiert erkennt Überlappung von Boden-Zellen", () => {
  const dungeon = dungeonAnlegen("katakombe", "kollision", LIMITS);
  const ebene = dungeon.ebenen[0];
  const start = [...ebene.karten.values()][0];
  const gleicheKarte = kartePlacement(ebene, start);
  assert.ok(kollidiert(ebene, gleicheKarte, start.x, start.y));
  assert.ok(!kollidiert(ebene, gleicheKarte, start.x + 200, start.y + 200));
});

test("Generator: platzierungErlaubt hält die maximale Ausdehnung ein", () => {
  const dungeon = dungeonAnlegen("katakombe", "ausdehnung", LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, LIMITS);
  const box = ausdehnung(ebene);
  assert.ok(box.breite <= LIMITS.maxAusdehnung.breite);
  assert.ok(box.hoehe <= LIMITS.maxAusdehnung.hoehe);

  // Eine riesige Karte weit außen darf nicht erlaubt sein.
  const karte = kartePlacement(ebene, [...ebene.karten.values()][0]);
  assert.equal(
    platzierungErlaubt(ebene, LIMITS, 5000, 5000, karte.breite, karte.hoehe),
    false,
    "Ausdehnung würde explodieren"
  );
});

test("Generator: naechsterZug liefert Placement oder null", () => {
  const dungeon = dungeonAnlegen("katakombe", "zug", LIMITS);
  const ebene = dungeon.ebenen[0];
  const rng = new Rng(ebene.seed);
  const p1 = naechsterZug(ebene, rng, LIMITS);
  assert.ok(p1, "erster Zug sollte eine Karte platzieren");
  assert.ok(ebene.karten.has(p1.id));
});

test("Generator: nichtErweiterbareAbschliessen schließt Ausgänge", () => {
  const eng = { ...LIMITS, maxKartenProEbene: 2 };
  const dungeon = dungeonAnlegen("katakombe", "abschluss", eng);
  const ebene = dungeon.ebenen[0];
  const rng = new Rng("abschluss");
  naechsterZug(ebene, rng, eng);
  naechsterZug(ebene, rng, eng); // Limit erreicht.
  const geschlossen = nichtErweiterbareAbschliessen(ebene, rng, eng);
  assert.ok(geschlossen.length > 0, "mindestens ein Ausgang sollte schließen");
  for (const id of geschlossen) {
    assert.ok(ebene.abgeschlossen.has(id));
    assert.ok(!freieAnker(ebene).some((a) => a.id === id));
  }
});

test("Generator: kartePlatzieren an konkretem Anker (Ziel-Tür exakt)", () => {
  const dungeon = dungeonAnlegen("hoehle", "ziel", LIMITS);
  const ebene = dungeon.ebenen[0];
  const rng = new Rng("ziel");
  const anker = freieAnker(ebene)[0];
  // h-kammer unrotiert hat 'w'- und 'o'-Türen; der Anker der Höhlen-
  // Eingangskarte kann jede Seite haben -> passende Rotation wählen.
  const { karteRotieren } = await_importSB();
  const gegen = { n: "s", s: "n", w: "o", o: "w" }[anker.seite];
  // h-kammer-Rotation suchen, die eine Tür zur Gegen-Seite hat.
  const basis = karteHolen("hoehle", "h-kammer");
  let rot = null;
  for (let r = 0; r < 4; r++) {
    const rk = r === 0 ? basis : karteRotieren(basis, r);
    if (rk.tueren.some((t) => t.seite === gegen)) {
      rot = r;
      break;
    }
  }
  assert.ok(rot !== null, "h-kammer sollte in einer Rotation an allen Seiten andocken können");
  const p = kartePlatzieren(ebene, rng, "h-kammer", rot, {
    placementId: anker.placementId,
    tuerIndex: anker.tuerIndex,
  });
  assert.ok(p);
  const port = ebene.karten.get(anker.placementId);
  const portTuer = port.tueren[anker.tuerIndex];
  assert.ok(portTuer.ziel, "Port-Tür sollte Ziel haben");
  assert.equal(portTuer.ziel.placementId, p.id);
});

/** Import-Broker für prefabs-Rotation (kein zweiter Static-Import nötig). */
function await_importSB() {
  return _sb;
}
const _sb = await import("../scripts/prefabs.mjs");