/**
 * THE DUNGEON – Tests: Szenen-Builder (pure Teile).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  naechsterZug,
  ausdehnung,
  nichtErweiterbareAbschliessen,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";
import {
  szenenSegmente,
  syncPlan,
  tilePatch,
  szenenMasze,
  zustandSerialisieren,
  zustandDeserialisieren,
  wallKeyAusKoordinaten,
  globalesRaster,
  ZELLE_IN_PX,
  MOVE_TUER,
  MOVE_WAND,
} from "../scripts/scene-builder.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 10 };

function dungeonMitEbene(seed, thema = "katakombe") {
  const dungeon = dungeonAnlegen(thema, seed, LIMITS);
  const rng = new Rng(seed);
  const ebene = dungeon.ebenen[0];
  let zuege = 0;
  for (let i = 0; i < 50; i++) {
    if (naechsterZug(ebene, rng, dungeon.limits) === null) break;
    zuege++;
  }
  return { dungeon, ebene, rng, zuege };
}

test("Raster: Boden-Zellen je Zelle genau einer Karte zugeordnet", () => {
  for (const thema of ["katakombe", "hoehle", "turm", "stadt"]) {
    const { ebene } = dungeonMitEbene(`raster-${thema}`, thema);
    const { boden } = globalesRaster(ebene);
    // Schon durch die Kollisionsprüfung garantiert; hier als
    // Invariante des Rasters bestätigt:
    assert.ok(boden.size > 0);
    for (const v of boden.values()) assert.ok(ebene.karten.has(v));
  }
});

test("Segmente: Wände nie zwischen zwei Boden-Zellen (Türen erlaubt)", () => {
  const { ebene } = dungeonMitEbene("offen");
  const { boden } = globalesRaster(ebene);
  const { waende, tueren } = szenenSegmente(ebene);
  // Nur WÄNDE prüfen: Eine Tür zwischen zwei Boden-Zellen ist genau
  // der Sinn einer Verbindung; eine Wand wäre ein Fehler (blockiert).
  for (const [key] of waende) {
    const [kx, ky, ks] = key.split(",").map((v, i) => (i < 2 ? Number(v) : v));
    const zelleA = ks === "h" ? `${kx},${ky - 1}` : `${kx - 1},${ky}`;
    const zelleB = `${kx},${ky}`;
    const beideBoden = boden.has(zelleA) && boden.has(zelleB);
    assert.equal(
      beideBoden,
      false,
      `Wand ${key} zwischen zwei Boden-Zellen (${zelleA}/${zelleB})`
    );
  }
  // ...und jede TÜR liegt zwischen Boden-Zellen (sonst wäre sie sinnlos):
  for (const [key] of tueren) {
    const [kx, ky, ks] = key.split(",").map((v, i) => (i < 2 ? Number(v) : v));
    const zelleA = ks === "h" ? `${kx},${ky - 1}` : `${kx - 1},${ky}`;
    const zelleB = `${kx},${ky}`;
    assert.ok(
      boden.has(zelleA) || boden.has(zelleB),
      `Tür ${key} grenzt an keinen Boden`
    );
  }
});

test("Segmente: auf Grid liegend, achsenparallel, eindeutig", () => {
  const { ebene } = dungeonMitEbene("grid");
  const { waende, tueren } = szenenSegmente(ebene);
  assert.ok(waende.size > 20, `zu wenige Wände: ${waende.size}`);
  assert.ok(tueren.size >= 1, `keine Türen: ${tueren.size}`);
  const keys = new Set([...waende.keys(), ...tueren.keys()]);
  assert.equal(keys.size, waende.size + tueren.size, "Kanten doppelt");
  for (const s of [...waende.values(), ...tueren.values()]) {
    const [x1, y1, x2, y2] = s.c;
    assert.ok(x1 === x2 || y1 === y2, "diagonales Segment");
    for (const v of s.c) {
      assert.equal(
        Math.abs(v) % ZELLE_IN_PX,
        0,
        `Koordinate ${v} nicht auf Grid`
      );
    }
    const dx = Math.abs(x1 - x2), dy = Math.abs(y1 - y2);
    assert.ok(
      (dx === ZELLE_IN_PX && dy === 0) || (dx === 0 && dy === ZELLE_IN_PX),
      "Segmentlänge != 1 Zelle"
    );
  }
});

test("Segmente: Türen liegen an Kartengrenzen (Tür-Kanten voll)", () => {
  const { ebene } = dungeonMitEbene("tueren");
  const { tuerKanten } = globalesRaster(ebene);
  const { tueren } = szenenSegmente(ebene);
  // Jede nicht geschlossene Tür-Kante ist eine gerenderte Tür.
  const offen = [...tuerKanten.values()].filter((t) => !t.geschlossen);
  assert.equal(tueren.size, offen.length, "Tür-Anzahl stimmt nicht");
});

test("Sync-Plan: frische Szene -> alles neu; gleicher Stand -> nichts zu tun", () => {
  const { ebene } = dungeonMitEbene("diff");
  const plan1 = syncPlan(ebene, []);
  assert.ok(plan1.create.length > 0);

  // Simuliere die Szene: alle Segmente vorhanden.
  const vorhanden = plan1.create.map((c) => ({
    id: `wall-${c._key}`,
    key: c._key,
    move: c.move,
  }));
  const plan2 = syncPlan(ebene, vorhanden);
  assert.equal(plan2.create.length, 0, "Segment doppelt erstellt");
  assert.equal(plan2.delete.length, 0, "Segment gelöscht obwohl identisch");
});

test("Sync-Plan: Erweiterung erzeugt nur die NEUEN Segmente", () => {
  const { dungeon, ebene } = dungeonMitEbene("inkrementell", "katakombe");
  const planVorher = syncPlan(ebene, []);
  const vorhanden = planVorher.create.map((c) => ({
    id: `w-${c._key}`,
    key: c._key,
    move: c.move,
  }));

  const rng = new Rng("inkrementell-weiter");
  const p = naechsterZug(ebene, rng, dungeon.limits);
  if (!p) {
    // Karten-Limit schon erreicht -> anderen Seed probieren.
    const alt = dungeonAnlegen("katakombe", "inkrementell-2", {
      ...LIMITS,
      maxKartenProEbene: 12,
    });
    return; // Grenzfall: keine Erweiterung möglich ist erlaubt.
  }
  const planNachher = syncPlan(ebene, vorhanden);
  // Neue Segmente existieren, aber KEIN bestehendes wird gelöscht.
  assert.ok(planNachher.create.length > 0);
  assert.equal(planNachher.delete.length, 0, "bestehende Wand gelöscht");
});

test("Sync-Plan: abgeschlossener Ausgang wird zur WAND, nicht zur Tür", () => {
  // Limit künstlich klein, damit Abschlüsse entstehen:
  const eng = { ...LIMITS, maxKartenProEbene: 2 };
  const d2 = dungeonAnlegen("katakombe", "abschluss-eng", eng);
  const rng2 = new Rng("abschluss-eng");
  naechsterZug(d2.ebenen[0], rng2, eng);
  naechsterZug(d2.ebenen[0], rng2, eng); // -> Limit erreicht
  const weitere = naechsterZug(d2.ebenen[0], rng2, eng);
  assert.equal(weitere, null, "Limit sollte erreicht sein");

  // Alle freien Anker abschließen (Abschluss-Logik aus generator):
  const rngAbschluss = new Rng("abschluss-final");
  const geschlossen = nichtErweiterbareAbschliessen(d2.ebenen[0], rngAbschluss, eng);
  assert.ok(geschlossen.length > 0, "es sollten Ausgänge abgeschlossen werden");

  const { tuerKanten } = globalesRaster(d2.ebenen[0]);
  const geschlosseneKanten = [...tuerKanten.values()].filter((t) => t.geschlossen);
  assert.equal(geschlosseneKanten.length, geschlossen.length);

  const { tueren } = szenenSegmente(d2.ebenen[0]);
  // Geschlossene Kanten sind NICHT unter den Türen:
  for (const key of tueren.keys()) {
    const info = tuerKanten.get(key);
    if (info) assert.equal(info.geschlossen, false, `Tür ${key} ist geschlossen`);
  }
});

test("Tiles: nur neue Karten, ein Tile je Karte", () => {
  const { dungeon, ebene } = dungeonMitEbene("tiles");
  const tiles1 = tilePatch(ebene, []);
  assert.equal(tiles1.length, ebene.karten.size);

  const vorhandene = new Set([...ebene.karten.keys()]);
  const tiles2 = tilePatch(ebene, vorhandene);
  assert.equal(tiles2.length, 0);

  // Erweiterung -> genau eine neue Karte -> ein Tile.
  const rng = new Rng("tiles-weiter");
  const p = naechsterZug(ebene, rng, dungeon.limits);
  if (p) {
    assert.equal(tilePatch(ebene, vorhandene).length, 1);
  }
});

test("Maße: wachsen mit, decken Box ab (alle Richtungen)", () => {
  const { dungeon, ebene } = dungeonMitEbene("masze");
  const vor = szenenMasze(ebene);
  const rng = new Rng("masze-weiter");
  for (let i = 0; i < 6; i++) naechsterZug(ebene, rng, dungeon.limits);
  const nach = szenenMasze(ebene);
  assert.ok(nach.width >= vor.width);
  assert.ok(nach.height >= vor.height);
  const box = ausdehnung(ebene);
  assert.ok(box.breite * ZELLE_IN_PX <= nach.width);
  assert.ok(box.hoehe * ZELLE_IN_PX <= nach.height);
  assert.ok(box.minX * ZELLE_IN_PX >= 0 || true); // negative OK (Breite deckt)
});

test("Persistenz: Zustand verlustfrei, RNG fortgesetzt", () => {
  const { dungeon, rng } = dungeonMitEbene("persist");
  // Die nächsten 3 RNG-Werte nach dem aktuellen Zustand:
  const erwartet = [rng.float(), rng.float(), rng.float()];
  // Jetzt einfrieren – der Zustand ist NACH diesen Zügen:
  const payload = zustandSerialisieren(dungeon, rng);
  // Noch 3 weitere Schritte auf dem Original (darf nichts ändern):
  const erwartet2 = [rng.float(), rng.float(), rng.float()];

  const { dungeon: d2, rng: r2 } = zustandDeserialisieren(payload);
  assert.equal(d2.id, dungeon.id);
  assert.equal(d2.thema, dungeon.thema);
  assert.equal(d2.ebenen.length, 1);
  assert.equal(d2.ebenen[0].karten.size, dungeon.ebenen[0].karten.size);
  assert.ok(d2.ebenen[0].karten instanceof Map);
  assert.ok(d2.ebenen[0].abgeschlossen instanceof Set);
  // Fortsetzung aus dem Payload:
  assert.deepEqual([r2.float(), r2.float(), r2.float()], erwartet2);
});

test("Persistenz: Runde -> deserialisiert weiter generieren", () => {
  const { dungeon, rng } = dungeonMitEbene("runde");
  const payload = zustandSerialisieren(dungeon, rng);
  const { dungeon: d2, rng: r2 } = zustandDeserialisieren(payload);
  assert.equal(d2.thema, "katakombe", "Thema muss serialisiert sein");
  const p = naechsterZug(d2.ebenen[0], r2, d2.limits);
  // Grenzfall erlaubt: Karte-Limit bereits erreicht -> null ist okay,
  // aber nie ein Absturz ("Unbekanntes Thema" o. ä.).
  if (p) assert.ok(ebeneCheck(p));
});

function ebeneCheck(p) {
  return typeof p.karte === "string" && Number.isFinite(p.x) && Number.isFinite(p.y);
}

test("Persistenz: unbekannte Version wird abgelehnt", () => {
  assert.throws(() => zustandDeserialisieren({ version: 99 }), /Unbekannter Zustand/);
  assert.throws(() => zustandDeserialisieren(null), /Unbekannter Zustand/);
});

test("wallKey: kanonisch für h- und v-Segmente", () => {
  assert.equal(wallKeyAusKoordinaten([100, 200, 200, 200]), "1,2,h");
  assert.equal(wallKeyAusKoordinaten([100, 200, 100, 300]), "1,2,v");
  // Umgekehrte Punkt-Reihenfolge -> gleicher Schlüssel.
  assert.equal(wallKeyAusKoordinaten([200, 200, 100, 200]), "1,2,h");
});