/**
 * THE DUNGEON – Tests: Tür-Trigger (pure Teile).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../scripts/rng.mjs";
import { dungeonAnlegen, naechsterZug, DEFAULT_LIMITS } from "../scripts/generator.mjs";
import {
  tuerInfoLesen,
  rueckenMarker,
  istTueroeffnung,
  AUSLOESER,
} from "../scripts/triggers.mjs";

const LIMITS = { ...DEFAULT_LIMITS, maxKartenProEbene: 8 };

function dungeonMitEbene(seed) {
  const dungeon = dungeonAnlegen("katakombe", seed, LIMITS);
  dungeon.ausloeser = AUSLOESER.BESTAETIGUNG;
  const rng = new Rng(seed);
  const ebene = dungeon.ebenen[0];
  for (let i = 0; i < 20; i++) if (naechsterZug(ebene, rng, LIMITS) === null) break;
  return { dungeon, rng, ebene };
}

test("Trigger: tuerInfoLesen findet unverbundene Dungeon-Türen", () => {
  const { dungeon, ebene } = dungeonMitEbene("info");
  // Simuliere eine Wall mit Flags (pure Tests):
  const placement = [...ebene.karten.values()][0];
  const tuerIndex = placement.tueren.findIndex((t) => !t.ziel);
  if (tuerIndex < 0) return; // Alle verbunden (ok).
  const wall = {
    flags: {
      "the-dungeon": { karte: placement.id, tuerIndex, dungeonId: dungeon.id },
    },
  };
  const info = tuerInfoLesen(wall, dungeon);
  assert.ok(info, "unverbundene Tür sollte gefunden werden");
  assert.equal(info.placement.id, placement.id);
  assert.equal(info.tuerIndex, tuerIndex);

  // Verbundene Tür -> null:
  const verbunden = placement.tueren.findIndex((t) => t.ziel);
  if (verbunden >= 0) {
    const wallV = {
      flags: {
        "the-dungeon": { karte: placement.id, tuerIndex: verbunden, dungeonId: dungeon.id },
      },
    };
    assert.equal(tuerInfoLesen(wallV, dungeon), null, "verbundene Tür darf nicht lösen");
  }

  // Fremde Wall ohne Flags -> null:
  assert.equal(tuerInfoLesen({ flags: {} }, dungeon), null);
});

test("Trigger: tuerInfoLesen ignoriert fremde Dungeons", () => {
  const { dungeon, ebene } = dungeonMitEbene("fremd");
  const placement = [...ebene.karten.values()][0];
  const tuerIndex = placement.tueren.findIndex((t) => !t.ziel);
  if (tuerIndex < 0) return;
  const wall = {
    flags: {
      "the-dungeon": { karte: placement.id, tuerIndex, dungeonId: "anderer-dungeon" },
    },
  };
  assert.equal(tuerInfoLesen(wall, dungeon), null);
});

test("Trigger: rueckenMarker liefert freie Anker auf Grid", () => {
  const { ebene } = dungeonMitEbene("ruecken");
  const marker = rueckenMarker(ebene);
  assert.ok(marker.length >= 0);
  for (const m of marker) {
    assert.equal(Math.abs(m.x) % 100, 0);
    assert.equal(Math.abs(m.y) % 100, 0);
    assert.ok(["n", "s", "o", "w"].includes(m.seite));
  }
});

test("Trigger: istTueroeffnung erkennt Öffnen (nicht Schließen)", () => {
  assert.equal(istTueroeffnung({ ds: 1 }), true);
  assert.equal(istTueroeffnung({ ds: 2 }), false);
  assert.equal(istTueroeffnung({ ds: 0 }), false);
  assert.equal(istTueroeffnung({}), false);
  assert.equal(istTueroeffnung(undefined), false);
});

test("Trigger: Auslöser-Modi existieren und sind distinkt", () => {
  const werte = Object.values(AUSLOESER);
  assert.equal(new Set(werte).size, werte.length);
  assert.ok(werte.includes("automatisch"));
  assert.ok(werte.includes("bestaetigung"));
  assert.ok(werte.includes("manuell"));
});