/**
 * THE DUNGEON – Persistenz v2 (Foundry-Seite + pure Serialisierung).
 *
 * Ergänzt scene-builder.mjs um die M2-Felder:
 *   - dungeon.verbindungen (Treppen/Portale)
 *   - dungeon.savePoints (inkl. Sperrstatus)
 *   - dungeon.sanktue (Ebenen-Nummern der Sanktuen)
 *   - dungeon.oberwelt (Rückkehr-Ziel)
 *   - dungeon.ausloeser (automatisch/bestaetigung/manuell)
 *   - dungeon.szenenIds (Ebenennummer -> Foundry-Szenen-Id)
 */

import { zustandSerialisieren as _basis, zustandDeserialisieren as _basisZurueck, MODUL, FLAGS } from "./scene-builder.mjs";
import { Rng } from "./rng.mjs";

/** Kompletter Dungeon-Zustand (v2) – reine Datenstruktur. */
export function zustandSerialisieren(dungeon, rng) {
  const payload = _basis(dungeon, rng);
  return {
    ...payload,
    version: 2,
    config: dungeon.config ?? {},
    content: dungeon.content ?? {},
    name: dungeon.name ?? null,
    resetCount: dungeon.resetCount ?? 0,
    verbindungen: dungeon.verbindungen ?? [],
    savePoints: dungeon.savePoints ?? [],
    sanktue: dungeon.sanktue ?? [],
    oberwelt: dungeon.oberwelt ?? null,
    ausloeser: dungeon.ausloeser ?? null,
    szenenIds: dungeon.szenenIds ?? {},
    ebenen: dungeon.ebenen.map((e) => ({
      ...payload.ebenen[dungeon.ebenen.indexOf(e)],
      typ: e.typ ?? "normal",
      protected: e.protected ?? [],
    })),
  };
}

/** v2-Zustand wieder auflösen (inkompatibel zu v1-Feldern abwärts). */
export function zustandDeserialisieren(data) {
  if (!data) throw new Error("Unbekannter Zustand");
  if (data.version !== 2) {
    // v1-Payload (M1): M2-Felder leer ergänzen.
    if (data.version === 1) {
      const rest = _basisZurueck(data);
      return {
        ...rest,
        dungeon: {
          ...rest.dungeon,
          verbindungen: [],
          savePoints: [],
          sanktue: [],
          oberwelt: null,
          ausloeser: null,
          szenenIds: {},
        },
      };
    }
    throw new Error("Unbekannter Zustand");
  }
  const dungeon = {
    id: data.id,
    thema: data.thema,
    seed: data.seed,
    config: data.config ?? {},
    content: data.content ?? {},
    name: data.name ?? null,
    resetCount: data.resetCount ?? 0,
    limits: data.limits,
    ausloeser: data.ausloeser ?? null,
    oberwelt: data.oberwelt ?? null,
    verbindungen: data.verbindungen ?? [],
    savePoints: data.savePoints ?? [],
    sanktue: data.sanktue ?? [],
    szenenIds: data.szenenIds ?? {},
    ebenen: data.ebenen.map((e) => ({
      ...e,
      karten: new Map(e.karten.map((p) => [p.id, p])),
      anker: new Map(e.anker.map((a) => [a.id, a])),
      abgeschlossen: new Set(e.abgeschlossen ?? []),
    })),
  };
  const rng = new Rng(data.seed);
  if (data.rng) rng.setState(data.rng);
  return { dungeon, rng };
}

/** Zustand in die Foundry-Szene(n) eines Dungeons schreiben. */
export async function zustandSpeichern(dungeon, rng) {
  if (typeof game === "undefined" || !game) return;
  const payload = zustandSerialisieren(dungeon, rng);
  for (const sceneId of Object.values(dungeon.szenenIds ?? {})) {
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;
    await scene.setFlag(MODUL, FLAGS.ZUSTAND, payload);
  }
}

/** Zustand aus der Foundry-Szene lesen. */
export function zustandLesen(scene) {
  const flag = scene?.getFlag?.(MODUL, FLAGS.ZUSTAND);
  if (!flag) return null;
  return zustandDeserialisieren(flag);
}