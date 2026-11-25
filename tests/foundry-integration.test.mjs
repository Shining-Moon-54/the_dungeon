/**
 * THE DUNGEON – Foundry-V14-Integrationstests.
 *
 * Läuft NUR, wenn ein Foundry-v14-`game`-Objekt existiert (Setup in
 * tests/foundry/README.md). Ohne Foundry werden alle Tests SKIPPED –
 * die pure Logik ist separat in den übrigen *.test.mjs abgedeckt.
 *
 * Geprüft (in Foundry):
 *   - Szene wird angelegt mit Grid/Walls/Tiles
 *   - inkrementelles Erweitern: bestehende Wände/Tiles bleiben, neue dazu
 *   - keine doppelten Segmente in der Szene
 *   - Türzustand (offen) überlebt eine Synchronisierung
 */

import { test as _test } from "node:test";
import assert from "node:assert/strict";

const IN_FOUNDRY =
  typeof globalThis.game !== "undefined" &&
  !!globalThis.game?.scenes &&
  typeof globalThis.Scene !== "undefined";

/** In Foundry: echte Tests; sonst: skip. */
const T = IN_FOUNDRY ? _test : _test.skip;

T("Foundry: Ebene als Szene anlegen (Walls + Tiles)", async () => {
  if (!game.user.isGM) return;
  const { dungeonAnlegen, ebeneGenerieren } = await import("../scripts/generator.mjs");
  const { Rng } = await import("../scripts/rng.mjs");
  const { ebeneSyncSzene, ZELLE_IN_PX } = await import("../scripts/scene-builder.mjs");

  const dungeon = dungeonAnlegen("katakombe", `it-${Date.now()}`, {
    maxKartenProEbene: 6,
    maxAusdehnung: { breite: 30, hoehe: 30 },
    maxEbenen: 3,
  });
  const rng = new Rng(dungeon.seed);
  ebeneGenerieren(dungeon.ebenen[0], dungeon.limits);

  const { scene } = await ebeneSyncSzene(dungeon, dungeon.ebenen[0], {
    name: "IT – Neuer Dungeon",
  });
  assert.ok(scene, "Szene muss existieren");
  assert.equal(scene.grid.size, ZELLE_IN_PX);

  // Modul-Walls vorhanden?
  const modulWalls = scene.walls.filter((w) => w.flags?.["the-dungeon"]);
  assert.ok(modulWalls.length > 10, `zu wenige Modul-Wände: ${modulWalls.length}`);

  // Keine doppelten Segmente:
  const keys = new Set();
  for (const w of modulWalls) {
    const k = w.c.map((v) => Math.round(v)).join(",");
    assert.ok(!keys.has(k), `doppeltes Segment ${k}`);
    keys.add(k);
  }

  // Tiles: eins pro Karte.
  const modulTiles = scene.tiles.filter((t) => t.flags?.["the-dungeon"]?.karte);
  assert.equal(modulTiles.length, dungeon.ebenen[0].karten.size);

  // Aufräumen:
  await scene.delete();
});

T("Foundry: inkrementelles Erweitern erhält Bestehendes", async () => {
  if (!game.user.isGM) return;
  const { dungeonAnlegen, naechsterZug } = await import("../scripts/generator.mjs");
  const { Rng } = await import("../scripts/rng.mjs");
  const { ebeneSyncSzene } = await import("../scripts/scene-builder.mjs");

  const dungeon = dungeonAnlegen("hoehle", `it-incr-${Date.now()}`, {
    maxKartenProEbene: 8,
    maxAusdehnung: { breite: 30, hoehe: 30 },
    maxEbenen: 3,
  });
  const rng = new Rng(dungeon.seed);
  const { scene } = await ebeneSyncSzene(dungeon, dungeon.ebenen[0], {
    name: "IT – Inkrementell",
  });

  const wallsVorher = scene.walls.filter((w) => w.flags?.["the-dungeon"]).length;
  const tilesVorher = scene.tiles.filter((t) => t.flags?.["the-dungeon"]).length;

  // Eine Erweiterung:
  naechsterZug(dungeon.ebenen[0], rng, dungeon.limits);
  await ebeneSyncSzene(dungeon, dungeon.ebenen[0], { szenenId: scene.id });

  const wallsNachher = scene.walls.filter((w) => w.flags?.["the-dungeon"]).length;
  const tilesNachher = scene.tiles.filter((t) => t.flags?.["the-dungeon"]).length;

  // Bestehende bleiben erhalten; neue sind DAZU gekommen.
  assert.ok(wallsNachher > wallsVorher, "keine neuen Wände");
  assert.equal(tilesNachher, tilesVorher + 1, "genau ein neues Tile (Karte)");

  // Eine sync-ÄNDERUNGSLOSE zweite Runde erzeugt NICHTS Neues:
  const wallsRunde2 = scene.walls.filter((w) => w.flags?.["the-dungeon"]).length;
  await ebeneSyncSzene(dungeon, dungeon.ebenen[0], { szenenId: scene.id });
  assert.equal(
    scene.walls.filter((w) => w.flags?.["the-dungeon"]).length,
    wallsRunde2,
    "Doppel-Sync darf keine Wände duplizieren"
  );

  await scene.delete();
});

T("Foundry: Türzustand (offen) überlebt die Synchronisierung", async () => {
  if (!game.user.isGM) return;
  const { dungeonAnlegen, naechsterZug } = await import("../scripts/generator.mjs");
  const { Rng } = await import("../scripts/rng.mjs");
  const { ebeneSyncSzene } = await import("../scripts/scene-builder.mjs");

  const dungeon = dungeonAnlegen("katakombe", `it-tuer-${Date.now()}`, {
    maxKartenProEbene: 6,
    maxAusdehnung: { breite: 30, hoehe: 30 },
    maxEbenen: 3,
  });
  const rng = new Rng(dungeon.seed);
  const { scene } = await ebeneSyncSzene(dungeon, dungeon.ebenen[0], { name: "IT – Tür" });

  // Eine Tür öffnen:
  const tuer = scene.walls.find((w) => w.door === 1);
  if (tuer) {
    await tuer.update({ ds: 1 });
    // Sync danach:
    naechsterZug(dungeon.ebenen[0], rng, dungeon.limits);
    await ebeneSyncSzene(dungeon, dungeon.ebenen[0], { szenenId: scene.id });
    const tuerNach = scene.walls.get(tuer.id);
    assert.equal(tuerNach.ds, 1, "Türzustand ging verloren");
  }
  await scene.delete();
});