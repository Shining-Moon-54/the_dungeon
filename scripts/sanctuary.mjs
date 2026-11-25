/**
 * THE DUNGEON – Sanktuen: sichere Zwischenebenen (M2, pure Logik).
 *
 * Ein Sanktum ist eine EBENE mit typ "sanctuary":
 *   - garantiert MONSTERFREI (keine Gegner-Marker),
 *   - mit Rastplatz (Lagerfeuer-Marker 'R'),
 *   - optional Händler (Marker 'H'),
 *   - mit Teleportationsportal (Marker 'P') zu den Save Points.
 *
 * Save Points (Rückkehrpunkte) sind Markierungen auf beliebigen Ebenen;
 * Spieler können dorthin teleportieren, GM kann jeden Punkt sperren.
 *
 * Pure Logik -> mit `node --test` testbar.
 */

import {
  markerDerEbene,
  markerKey,
  ebeneNr,
  ebeneAnlegen,
} from "./levels.mjs";
import { GeneratorFehler } from "./generator.mjs";

/** Save-Point-Datenmodell: { id, ebeneNr, placementId, index, name, gesperrt } */

/**
 * Neues Sanktum als Zwischenebene anlegen (sichere Raststätte).
 *
 * @param {object} dungeon mutierter Dungeon
 * @param {object} rng
 * @param {object} optionen { haendler?: boolean, rast?: boolean }
 * @returns {object} die neue Sanktum-Ebene
 */
export function sanktumAnlegen(dungeon, rng, optionen = {}) {
  dungeon.verbindungen = dungeon.verbindungen ?? [];
  dungeon.sanktue = dungeon.sanktue ?? [];
  // Nummerierung: nächste freie Nummer nach der tiefsten Ebene.
  const nr =
    dungeon.ebenen.reduce((m, e) => Math.max(m, e.nr), 0) + 1;
  if (dungeon.limits && nr > dungeon.limits.maxEbenen) {
    throw new GeneratorFehler(`Sanktum: Ebene ${nr} > maxEbenen`);
  }
  const ebene = ebeneAnlegen(dungeon, nr, rng, {
    typ: "sanctuary",
    startKategorie: "sanktum",
  });
  dungeon.sanktue.push(ebene.nr);
  return ebene;
}

/** Sanktum-Ebenen eines Dungeons. */
export function sanktue(dungeon) {
  return dungeon.ebenen.filter((e) => e.typ === "sanctuary");
}

/**
 * Rastplatz-Marker ('R') eines Sanktums – Spieler ruhen aus,
 * Long-Rest-kompatibel (Foundry-seitig per dnd5e-Rest-Dialog).
 */
export function rastplaetze(ebene) {
  return markerDerEbene(ebene, "rast");
}

/** Händler-Marker ('H') eines Sanktums. */
export function haendler(ebene) {
  return markerDerEbene(ebene, "haendler");
}

/* ------------------------------------------------------------------ */
/* Save Points                                                          */
/* ------------------------------------------------------------------ */

/**
 * Save Point registrieren (GM-Aktion oder automatisch beim Erreichen
 * eines Sanktums). Idempotent: gleiche Adresse -> kein Doppel.
 *
 * @returns {object} der Save Point
 */
export function savePointRegistrieren(dungeon, ebene, marker, name) {
  dungeon.savePoints = dungeon.savePoints ?? [];
  const adresse = markerKey(ebene.nr, marker.placementId, marker.index);
  const vorhanden = dungeon.savePoints.find(
    (s) => markerKey(s.ebeneNr, s.placementId, s.index) === adresse
  );
  if (vorhanden) return vorhanden;
  const punkt = {
    id: `sp${dungeon.savePoints.length + 1}`,
    ebeneNr: ebene.nr,
    placementId: marker.placementId,
    index: marker.index,
    name: name ?? `Save Point ${dungeon.savePoints.length + 1}`,
    gesperrt: false, // GM kann für Spieler sperren
    x: marker.x,
    y: marker.y,
  };
  dungeon.savePoints.push(punkt);
  return punkt;
}

/** Für Spieler freigegebene Save Points (GM sieht alle). */
export function verfuegbareSavePoints(dungeon, istGM = false) {
  return (dungeon.savePoints ?? []).filter((s) => istGM || !s.gesperrt);
}

/** Save Point für Spieler sperren/entsperren. */
export function savePointSperren(dungeon, savePointId, gesperrt = true) {
  const p = (dungeon.savePoints ?? []).find((s) => s.id === savePointId);
  if (!p) throw new GeneratorFehler(`Save Point '${savePointId}' unbekannt`);
  p.gesperrt = !!gesperrt;
  return p;
}

/**
 * Teleport-Ziel eines Save Points auflösen (Ebene + Marker-Koordinaten).
 * @returns {object|null} { ebene, savePoint }
 */
export function teleportZiel(dungeon, savePointId) {
  const p = (dungeon.savePoints ?? []).find((s) => s.id === savePointId);
  if (!p) return null;
  const ebene = ebeneNr(dungeon, p.ebeneNr);
  if (!ebene) return null;
  return { ebene, savePoint: p };
}

/**
 * Beim Betreten eines Sanktums: Sanktum automatisch als Save Point
 * registrieren (default an), falls noch nicht vorhanden.
 */
export function sanktumAlsSavePoint(dungeon, sanktumEbene, name) {
  const marker =
    markerDerEbene(sanktumEbene, "portal")[0] ??
    markerDerEbene(sanktumEbene, "eingang")[0] ??
    markerDerEbene(sanktumEbene, "rast")[0];
  if (!marker) return null;
  return savePointRegistrieren(dungeon, sanktumEbene, marker, name);
}

/**
 * Rückkehr zur Taverne/Oberwelt: Der Dungeon-Eingang (Marker 'E' auf
 * Ebene 1) ist das Ziel. `dungeon.oberwelt` hält die konfigurierte
 * Szene-Id der Oberwelt (GM setzt sie beim Dungeon-Anlegen).
 *
 * @returns {object|null} { szenenId, x, y } oder null (nicht konfiguriert)
 */
export function rueckkehrZiel(dungeon) {
  if (!dungeon.oberwelt) return null;
  const ebene1 = ebeneNr(dungeon, 1);
  if (!ebene1) return null;
  const eingang = markerDerEbene(ebene1, "eingang")[0];
  return {
    szenenId: dungeon.oberwelt.szenenId ?? null,
    x: dungeon.oberwelt.x ?? (eingang ? eingang.x * 100 : null),
    y: dungeon.oberwelt.y ?? (eingang ? eingang.y * 100 : null),
  };
}