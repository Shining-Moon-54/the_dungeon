/**
 * THE DUNGEON – Ebenen & Treppen (M2, pure Logik).
 *
 * Ein Dungeon besteht aus mehreren Ebenen (je Ebene eine Szene).
 * Verbindungen zwischen Ebenen:
 *
 *   - TREPPEN: Marker 'T' auf einer Karte. Eine Treppe führt auf die
 *     Ebene nr+1 (Abstieg) bzw. zurück auf nr-1 (Aufstieg). Treppen
 *     sind BEIDSEITIG: Beim ersten Benutzen wird die Zielebene
 *     (einschließlich Rückweg-Treppe) erzeugt.
 *   - PORTALE: Marker 'P' (magischer Durchgang) verbinden zwei beliebige
 *     Ebenen (auch nicht-adjazente), gleicher Mechanismus.
 *   - EINGANG: Marker 'E' auf Ebene 1 = Rückweg zur Taverne/Oberwelt
 *     (Ziel-Szene konfigurierbar, siehe `dungeon.oberwelt`).
 *
 * Sanktuen (sichere Zwischenebenen) liegen in sanctuary.mjs.
 *
 * Datenmodell:
 *   dungeon.ebenen: Array von Ebenen (generator.neueEbene)
 *   ebene.typ: "normal" | "sanctuary"
 *   dungeon.verbindungen: [
 *     { id, von: {ebeneNr, placementId, markerIndex},
 *              nach: {ebeneNr, placementId, markerIndex},
 *       art: "treppe" | "portal" }
 *   ]
 *
 * Pure Logik -> mit `node --test` testbar.
 */

import {
  neueEbene as _neueEbene,
  kartePlatzieren,
  kartePlacement,
  GeneratorFehler, ebeneDeck, platzierungErlaubt,
} from "./generator.mjs";

/** Marker-Kürzel in den Karten-Grids. */
export const MARKER = { TREPPE: "treppe", EINGANG: "eingang", PORTAL: "portal" };

/* ------------------------------------------------------------------ */
/* Marker-Zugriff                                                       */
/* ------------------------------------------------------------------ */

/**
 * Treppen-/Portal-Marker einer Ebene auflisten.
 * @returns {Array} [{ placementId, index, art, x, y }] – GLOBALE Koordinaten.
 */
export function markerDerEbene(ebene, art) {
  const liste = [];
  for (const placement of ebene.karten.values()) {
    const karte = kartePlacement(ebene, placement);
    karte.marker.forEach((m, index) => {
      if (art && m.art !== art) return;
      liste.push({
        placementId: placement.id,
        index,
        art: m.art,
        x: placement.x + m.cx,
        y: placement.y + m.cy,
      });
    });
  }
  return liste;
}

/** Markerschlüssel (Verbindungs-Adresse). */
export const markerKey = (ebeneNr, placementId, index) =>
  `${ebeneNr}:${placementId}:${index}`;

/** Marker aus dungeon.verbindungen zur Adresse auflösen. */
export function verbindungFuerMarker(dungeon, ebeneNr, placementId, index) {
  const key = markerKey(ebeneNr, placementId, index);
  return (
    dungeon.verbindungen?.find(
      (v) => key === markerKey(v.von.ebeneNr, v.von.placementId, v.von.index)
    ) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Ebenen-Verwaltung                                                   */
/* ------------------------------------------------------------------ */

/** Höchste vergebene Ebenennummer. */
export function maximaleEbene(dungeon) {
  return dungeon.ebenen.reduce((max, e) => Math.max(max, e.nr), 0);
}

/** Ebene nach Nummer. */
export function ebeneNr(dungeon, nr) {
  return dungeon.ebenen.find((e) => e.nr === nr) ?? null;
}

/**
 * Neue Ebene anlegen (Datenstruktur + Startkarte).
 *
 * @param {object} dungeon   mutierter Dungeon
 * @param {number} nr        Ebenennummer (>= 1)
 * @param {object} rng       Seeded RNG
 * @param {object} optionen  { typ?: "normal"|"sanctuary", startKategorie? }
 * @returns {object} die neue Ebene
 */
/**
 * Neue Ebene anlegen (Datenstruktur + Startkarte).
 *
 * @param {object} dungeon   mutierter Dungeon
 * @param {number} nr        Ebenennummer (>= 1)
 * @param {object} rng       Seeded RNG
 * @param {object} optionen  { typ?: "normal"|"sanctuary", startKategorie? }
 * @returns {object} die neue Ebene
 */
export function ebeneAnlegen(dungeon, nr, rng, optionen = {}) {
  if (nr < 1) throw new GeneratorFehler(`Ebene ${nr} < 1`);
  if (ebeneNr(dungeon, nr)) {
    throw new GeneratorFehler(`Ebene ${nr} existiert bereits`);
  }
  if (dungeon.limits && nr > dungeon.limits.maxEbenen) {
    throw new GeneratorFehler(`Ebene ${nr} > maxEbenen`);
  }
  const ebene = _neueEbene(nr, dungeon.seed);
  ebene.thema = dungeon.thema;
  ebene.typ = optionen.typ ?? "normal";
  if(Array.isArray(dungeon.ebenen[0]?.deckIds)) ebene.deckIds=[...dungeon.ebenen[0].deckIds];

  // Startkarte: normal ein "eingang", Sanktum eine eigene Halle.
  const kategorie = optionen.startKategorie ?? "eingang";
  const start = ebeneDeck(ebene).find(
    (k) => k.kategorie === kategorie
  );
  if (!start) {
    throw new GeneratorFehler(`keine '${kategorie}'-Karte im Thema`);
  }
  const rot = rng.int(0, 3);
  const rotated=karteRotieren(start,rot);
  if(dungeon.limits&&!platzierungErlaubt(ebene,dungeon.limits,0,0,rotated.breite,rotated.hoehe))throw new GeneratorFehler('Startkarte überschreitet Ebenenlimit');
  kartePlatzieren(ebene, rng, start.id, rot, null);
  dungeon.ebenen.push(ebene);
  return ebene;
}

/* ------------------------------------------------------------------ */
/* Treppen / Portale benutzen                                          */
/* ------------------------------------------------------------------ */

/**
 * Treppe oder Portal benutzen: verbindet zwei Marker BEIDSEITIG.
 *
 * Existiert keine Verbindung, wird die Zielebene angelegt:
 *   - Treppe  -> Ebene nr+1 (oder zurück nr-1, wenn dort schon eine
 *                tiefere Ebene existiert: Richtungslogik)
 *   - Portal  -> Ebene nr+1 (magisch; kann später beliebig)
 * Die Zielebene erhält eine RÜCKWAY-Karte mit passendem Marker,
 * damit der Weg BEIDE Richtungen funktioniert.
 *
 * @returns {object} { verbindung, zielEbene, neu: boolean }
 */
export function verbindungOeffnen(dungeon, ebene, marker, rng) {
  dungeon.verbindungen = dungeon.verbindungen ?? [];
  const adresse = markerKey(ebene.nr, marker.placementId, marker.index);
  // Bereits verbunden?
  const vorhanden = dungeon.verbindungen.find((v) =>
    [v.von, v.nach].some(
      (a) => markerKey(a.ebeneNr, a.placementId, a.index) === adresse
    )
  );
  if (vorhanden) {
    const zielNr =
      vorhanden.von.ebeneNr === ebene.nr
        ? vorhanden.nach.ebeneNr
        : vorhanden.von.ebeneNr;
    return { verbindung: vorhanden, zielEbene: ebeneNr(dungeon, zielNr), neu: false };
  }

  // Noch frei: Ziel bestimmen.
  const art = marker.art === MARKER.PORTAL ? "portal" : "treppe";
  const zielNr = _zielEbeneFuerMarker(dungeon, ebene, marker, art);

  // Zielebene existiert? Sonst anlegen + Rückweg-Karte platzieren.
  let ziel = ebeneNr(dungeon, zielNr);
  let neu = false;
  if (!ziel) {
    // A dedicated arrival room has its return marker and two free exits.
    // Legacy allowlists can still resolve their original entrance and stair deck.
    const hasArrival=ebeneDeck(ebene).some(c=>c.kategorie==='ankunft'&&c.breite<=dungeon.limits.maxAusdehnung.breite&&c.hoehe<=dungeon.limits.maxAusdehnung.hoehe);
    ziel = ebeneAnlegen(dungeon, zielNr, rng, { typ: "normal", startKategorie:hasArrival?'ankunft':'eingang' });
    neu = true;
  }

  // Freien Marker auf der Zielebene als Gegenstück suchen.
  let gegen =
    _freierMarker(dungeon, ziel, art) ?? _freierMarker(dungeon, ziel, MARKER.TREPPE);
  if (!gegen && neu) {
    // Frische Ebene hat nur eine Eingangskarte: RÜCKWEG-KARTE
    // (Treppen-/Portal-Karte) an einen freien Anker andocken.
    gegen = _rueckwegKartePlatzieren(dungeon, ziel, rng, art);
  }
  if (!gegen) {
    if(neu)dungeon.ebenen.splice(dungeon.ebenen.indexOf(ziel),1);
    throw new GeneratorFehler(`Zielebene ${zielNr} ohne freien ${art}-Marker`);
  }

  const verbindung = {
    id: `v${dungeon.verbindungen.length + 1}`,
    von: { ebeneNr: ebene.nr, placementId: marker.placementId, index: marker.index },
    nach: { ebeneNr: ziel.nr, placementId: gegen.placementId, index: gegen.index },
    art,
  };
  dungeon.verbindungen.push(verbindung);
  return { verbindung, zielEbene: ziel, neu };
}

/** Ziel-Ebenennummer für einen Marker (Treppe: +1 oder -1; Portal: +1). */
function _zielEbeneFuerMarker(dungeon, ebene, marker, art) {
  if (art === "portal") return ebene.nr + 1;
  // Treppe: Standard abwärts; bei "turm"-Thema aufwärts.
  if (dungeon.thema === "turm") {
    // Aufwärts, außer die Treppe liegt unter der Eingangsebene.
    return ebene.nr + 1;
  }
  return ebene.nr + 1;
}

/** Noch NICHT verbundener Marker einer Art auf einer Ebene. */
function _freierMarker(dungeon, ebene, art) {
  const benutzt = new Set(
    (dungeon.verbindungen ?? []).flatMap((v) => [
      markerKey(v.von.ebeneNr, v.von.placementId, v.von.index),
      markerKey(v.nach.ebeneNr, v.nach.placementId, v.nach.index),
    ])
  );
  return (
    markerDerEbene(ebene, art).find(
      (m) => !benutzt.has(markerKey(ebene.nr, m.placementId, m.index))
    ) ?? null
  );
}

/**
 * Rückweg-Karte auf einer frischen Zielebene platzieren: dockt eine
 * TREPPE-Karte an einen freien Anker der Ebene an und liefert deren
 * (noch freien) Treppen-Marker.
 */
function _rueckwegKartePlatzieren(dungeon, ziel, rng, _art) {
  const anker = freieAnkerFn(ziel);
  if (anker.length === 0) return null;
  const treppenKarten = ebeneDeck(ziel).filter(
    (k) => k.kategorie === "treppe"
  );
  if (treppenKarten.length === 0) return null;

  // Erste Kombination (Karte x Rotation x Anker), die kollisionsfrei
  // andockt – deterministisch über die RNG.
  for (const ankerObj of rng.shuffle(anker)) {
    for (const karte of rng.shuffle(treppenKarten)) {
      for (let rot = 0; rot < 4; rot++) {
        const rk = rot === 0 ? karte : karteRotieren(karte, rot);
        const port = ziel.karten.get(ankerObj.placementId);
        const portTuer = port?.tueren[ankerObj.tuerIndex];
        if (!portTuer || portTuer.ziel) continue;
        const gegenSeite = gegenSeiteFn(portTuer.seite);
        const neueTuer = rk.tueren.find((t) => t.seite === gegenSeite);
        if (!neueTuer) continue;
        if(!rk.marker.some(m=>m.art==='treppe'))continue;
        const x=portTuer.seite==='n'||portTuer.seite==='s'?port.x+portTuer.cx-neueTuer.cx:portTuer.seite==='w'?port.x-rk.breite:port.x+port.karteBreite;
        const y=portTuer.seite==='w'||portTuer.seite==='o'?port.y+portTuer.cy-neueTuer.cy:portTuer.seite==='n'?port.y-rk.hoehe:port.y+port.karteHoehe;
        if(dungeon.limits&&!platzierungErlaubt(ziel,dungeon.limits,x,y,rk.breite,rk.hoehe))continue;
        try {
          const placement = kartePlatzieren(
            ziel, rng, karte.id, rot,
            { placementId: ankerObj.placementId, tuerIndex: ankerObj.tuerIndex }
          );
          const marker = markerDerEbene(ziel, "treppe").find(
            (m) => m.placementId === placement.id
          );
          if (marker) return marker;
        } catch {
          // Kollision o. ä. -> nächste Kombination.
        }
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Interne Helfer                                                       */
/* ------------------------------------------------------------------ */

import { karteRotieren, gegenSeite as gegenSeiteFn } from "./prefabs.mjs";
import { freieAnker as freieAnkerFn } from "./generator.mjs";

