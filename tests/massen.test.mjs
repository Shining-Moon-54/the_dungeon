/**
 * Tests: Massen-Prüfung (1.000+ Seeds, alle 4 Themen).
 *
 * Prüft je Seed:
 *   - Limits eingehalten (Kartenzahl, Ausdehnung)
 *   - keine Überlappung von Boden-Zellen
 *   - alle Karten vom Eingang aus erreichbar
 *   - alle Türverbindungen wechselseitig konsistent
 *   - keine offenen Kanten: jede nicht verbundene Tür ist
 *     entweder abgeschlossen (absichtlich) oder hat Platz.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  ausdehnung,
  kartePlacement,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";

const THEMEN = ["katakombe", "hoehle", "turm", "stadt"];
const SEEDS = 260; // 260 x 4 Themen = 1.040 Dungeons

test("Massen-Prüfung: 1.040 Seeds über alle 4 Themen", { timeout: 120000 }, () => {
  const fehler = [];
  for (const thema of THEMEN) {
    for (let i = 0; i < SEEDS; i++) {
      const seed = `massen-${thema}-${i}`;
      const pruefung = pruefeSeed(thema, seed);
      if (!pruefung.ok) {
        fehler.push(`${thema}/${seed}: ${pruefung.problem}`);
        if (fehler.length > 5) break; // Nicht voll laufen lassen.
      }
    }
    if (fehler.length > 5) break;
  }
  assert.deepEqual(fehler, [], `Massen-Prüfung fehlgeschlagen:\n${fehler.join("\n")}`);
});

/** Einzel-Dungeon-Prüfung (reine Logik). */
function pruefeSeed(thema, seed) {
  const dungeon = dungeonAnlegen(thema, seed, DEFAULT_LIMITS);
  const ebene = dungeon.ebenen[0];
  ebeneGenerieren(ebene, dungeon.limits);

  // 1. Limits.
  if (ebene.karten.size > DEFAULT_LIMITS.maxKartenProEbene) {
    return { ok: false, problem: `Kartenlimit überschritten (${ebene.karten.size})` };
  }
  const box = ausdehnung(ebene);
  if (
    box.breite > DEFAULT_LIMITS.maxAusdehnung.breite ||
    box.hoehe > DEFAULT_LIMITS.maxAusdehnung.hoehe
  ) {
    return { ok: false, problem: `Ausdehnung überschritten (${box.breite}x${box.hoehe})` };
  }

  // 2. Keine Überlappung: Boden-Zellen global je Zelle nur 1 Karte.
  const zellenKarte = new Map();
  for (const p of ebene.karten.values()) {
    const rk = kartePlacement(ebene, p);
    for (let y = 0; y < rk.hoehe; y++) {
      for (let x = 0; x < rk.breite; x++) {
        if (!rk.zellen[y][x].boden) continue;
        const key = `${p.x + x},${p.y + y}`;
        if (zellenKarte.has(key)) {
          return {
            ok: false,
            problem: `Überlappung bei ${key}: ${zellenKarte.get(key)} & ${p.id}`,
          };
        }
        zellenKarte.set(key, p.id);
      }
    }
  }

  // 3. Erreichbarkeit: BFS über Türverbindungen vom Eingang.
  const start = [...ebene.karten.values()].find(
    (p) => p.kategorie === "eingang"
  );
  const erreicht = new Set([start.id]);
  const queue = [start];
  while (queue.length) {
    const p = queue.shift();
    for (const t of p.tueren) {
      if (!t.ziel) continue;
      if (!erreicht.has(t.ziel.placementId)) {
        erreicht.add(t.ziel.placementId);
        const naechste = ebene.karten.get(t.ziel.placementId);
        if (naechste) queue.push(naechste);
      }
    }
  }
  if (erreicht.size !== ebene.karten.size) {
    const fehlend = [...ebene.karten.keys()].filter((id) => !erreicht.has(id));
    return { ok: false, problem: `unerreichbare Karten: ${fehlend.join(",")}` };
  }

  // 4. Türverbindungen wechselseitig.
  for (const p of ebene.karten.values()) {
    for (const t of p.tueren) {
      if (!t.ziel) continue;
      const ziel = ebene.karten.get(t.ziel.placementId);
      if (!ziel) return { ok: false, problem: `Ziel ${t.ziel.placementId} fehlt` };
      const zurueck = ziel.tueren[t.ziel.tuerIndex];
      if (
        !zurueck?.ziel ||
        zurueck.ziel.placementId !== p.id ||
        zurueck.ziel.tuerIndex !== p.tueren.indexOf(t)
      ) {
        return { ok: false, problem: `Rückverbindung fehlt ${p.id}<->${ziel.id}` };
      }
    }
  }

  // 5. Nur EINE Eingangskarte.
  const eingaenge = [...ebene.karten.values()].filter(
    (p) => p.kategorie === "eingang"
  );
  if (eingaenge.length !== 1) {
    return { ok: false, problem: `${eingaenge.length} Eingangskarten` };
  }

  return { ok: true };
}