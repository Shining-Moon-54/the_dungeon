/**
 * THE DUNGEON – Tür-Trigger & Auslöser-Verwaltung (Foundry + pure Teile).
 *
 * Drei einstellbare Auslöser-Modi pro Dungeon:
 *   - "automatisch"  : Öffnet ein Spieler eine unverbundene Tür, wird
 *                      die nächste Karte SOFORT an dieser Tür angedockt.
 *   - "bestaetigung" : GM bekommt einen Dialog mit Bestätigung.
 *   - "manuell"      : Nichts passiert automatisch; GM generiert per
 *                      Kontextmenü/Button selbst.
 *
 * Gleichzeitiges Öffnen mehrerer Türen (mehrere Spieler) ist abgesichert:
 * `dungeonErweitern` läuft hinter einer Sperre und synchronisiert den
 * Zustand vor jeder Erweiterung aus den Szene-Flags (Socket-Broadcast
 * anderer GMs wird verarbeitet).
 */

import { freieAnker, kartePlacement } from "./generator.mjs";
import { gegenSeite } from "./prefabs.mjs";
import { MODUL, FLAGS } from "./scene-builder.mjs";
import { Rng } from "./rng.mjs";
import { zustandDeserialisieren } from "./persistenz.mjs";

/** Auslöser-Modi. */
export const AUSLOESER = {
  AUTOMATISCH: "automatisch",
  BESTAETIGUNG: "bestaetigung",
  MANUELL: "manuell",
};

/** Sperr-Flag gegen parallele Erweiterungen. */
let _erweiterungAktiv = false;

/**
 * Tür-Öffnen verarbeiten: ist die Tür ein Dungeon-Anker ohne Verbindung,
 * greift der konfigurierte Auslöser-Modus.
 *
 * @param {Wall} wall             geöffnete Tür (Foundry-Wall)
 * @param {object} eintrag         aktiver Dungeon-Eintrag { dungeon, rng }
 * @param {object} optionen       { erweitern: async (dungeon, rng) => … }
 * @returns {Promise<object|null>} Ergebnis der Erweiterung oder null
 */
export async function tuerGeoeffnet(wall, eintrag, optionen = {}) {
  const dungeon = eintrag?.dungeon;
  if (!dungeon) return null;
  const modus = dungeon.ausloeser ?? AUSLOESER.BESTAETIGUNG;
  if (modus === AUSLOESER.MANUELL) return null;

  const info = tuerInfoLesen(wall, dungeon);
  if (!info) return null; // Keine unverbundene Dungeon-Tür.

  const erweitern = optionen.erweitern;
  if (typeof erweitern !== "function") return null;

  if (modus === AUSLOESER.AUTOMATISCH) {
    return _sicherErweitern(dungeon, eintrag.rng, erweitern);
  }
  // BESTAETIGUNG: GM-Dialog; ohne Foundry-UI (Tests) direkt ausführen.
  if (typeof globalThis.Dialog === "undefined") {
    return _sicherErweitern(dungeon, eintrag.rng, erweitern);
  }
  return new Promise((resolve) => {
    globalThis.Dialog.confirm({
      title: "The Dungeon",
      content:
        `<p>Ein Spieler öffnet eine unbekannte Tür${info.name ? ` (${info.name})` : ""}.</p>` +
        "<p><em>Nächsten Dungeon-Bereich generieren?</em></p>",
      yes: () => _sicherErweitern(dungeon, eintrag.rng, erweitern).then(resolve),
      no: () => resolve(null),
      defaultYes: true,
    });
  });
}

/** Erweiterung mit Sperr-Sicherung (parallele Spieler-Öffnungen). */
async function _sicherErweitern(dungeon, rng, erweitern) {
  if (_erweiterungAktiv) return null;
  _erweiterungAktiv = true;
  try {
    return await erweitern(dungeon, rng);
  } finally {
    _erweiterungAktiv = false;
  }
}

/**
 * Tür-Info lesen: gehört die Wand zu einem Dungeon-Placement und ist
 * diese Tür noch unverbunden (freier Anker)?
 *
 * @returns {object|null} { placement, tuerIndex, name } oder null
 */
export function tuerInfoLesen(wall, dungeon) {
  const flags = wall?.flags?.[MODUL] ?? {};
  const kartenId = flags[FLAGS.KARTE];
  const tuerIndex = flags[FLAGS.TUER_INDEX];
  if (!kartenId || tuerIndex === undefined || tuerIndex === null) return null;
  const dungeonId = flags[FLAGS.DUNGEON_ID] ?? dungeon?.id;
  if (dungeonId && dungeon && dungeonId !== dungeon.id) return null;

  // Aktive Ebene (letzte) — Tür-Trigger wirken auf der aktuellen Ebene:
  for (const ebene of dungeon.ebenen) {
    if (flags[FLAGS.EBENE_NR] != null && flags[FLAGS.EBENE_NR] !== ebene.nr) continue;
    const placement = ebene.karten.get(kartenId);
    if (!placement) continue;
    const tuer = placement.tueren[tuerIndex];
    if (!tuer || tuer.ziel || ebene.abgeschlossen.has(`${kartenId}:${tuerIndex}`)) continue; // bereits verbunden
    const karte = kartePlacement(ebene, placement);
    return {
      placement,
      tuerIndex,
      name: `${karte.name} – Tür ${tuerIndex + 1} (${tuer.seite})`,
      ebene,
    };
  }
  return null;
}

/**
 * Freie Anker als Karten-Rücken-Marker-Daten aufbereiten (GM-Sicht).
 * Foundry-seitig werden das unsichtbare Tiles mit Rücken-Symbol.
 */
export function rueckenMarker(ebene) {
  return freieAnker(ebene).map((a) => ({
    x: a.kante.x * 100,
    y: a.kante.y * 100,
    seite: a.seite,
    placementId: a.placementId,
    tuerIndex: a.tuerIndex,
  }));
}

/** Pure: prüfen, ob eine Wall-Änderung ein Tür-Öffnen ist. */
export function istTueroeffnung(changed) {
  return typeof changed?.ds === "number" && changed.ds === 1;
}

/** Re-export für Tests/API. */
export { zustandDeserialisieren };