/**
 * THE DUNGEON – Graph-Generator (v2).
 *
 * Kernregeln:
 *   - Züge laufen über eine seedbare RNG -> deterministisch.
 *   - Karten können ROTIERT werden (0/90/180/270°), damit jede Karte an
 *     jede Türseite andocken kann.
 *   - Passt die erste gezogene Karte nicht (Kollision/Limit), werden
 *     ALTERNATIVKARTEN (andere Karte + andere Rotation) probiert.
 *   - Kartenanzahl je Ebene und maximale Ausdehnung werden strikt
 *     eingehalten (Prüfung VOR dem Platzieren).
 *   - Ausgänge, an denen keine Karte mehr platziert werden kann, werden
 *     SINNVOLL ABGESCHLOSSEN: Tür wird zu einer geschlossenen Wand
 *     (Sackgasse) – keine offenen Kanten in der Szene.
 *
 * Pure Logik ohne Foundry-Abhängigkeiten -> mit `node --test` testbar.
 */

import { createRng } from "./rng.mjs";
import {
  THEMEN,
  deckLaden,
  karteRotieren,
  tuerKante,
  gegenSeite,
} from "./prefabs.mjs";

/** Standard-Limits eines Dungeons (per Settings übersteuerbar). */
export const DEFAULT_LIMITS = {
  maxKartenProEbene: 12,
  maxAusdehnung: { breite: 40, hoehe: 40 }, // Grid-Zellen
  maxEbenen: 5,
};

/** Kartenauswahl-Gewichte je Kategorie. */
export const KATEGORIE_GEWICHTE = {
  eingang: 0,
  raum: 5,
  gang: 4,
  kreuzung: 2,
  sackgasse: 1,
  treppe: 0,
  sanktum: 0,
  boss: 0,
};

/** Anteil am Karten-Limit, ab dem eine Treppe bevorzugt wird. */
export const TREPPE_AB_ANTEIL = 0.6;

/** Fehlerklasse des Generators. */
export class GeneratorFehler extends Error {
  constructor(problem) {
    super(`Generator: ${problem}`);
    this.name = "GeneratorFehler";
  }
}

/* ------------------------------------------------------------------ */
/* Deck-Cache                                                          */
/* ------------------------------------------------------------------ */

const _deckCache = new Map();
function deck(thema) {
  if (!_deckCache.has(thema)) _deckCache.set(thema, deckLaden(thema));
  return _deckCache.get(thema);
}

/** Karte (unrotiert) aus dem Cache holen. */
export function deckCacheLeeren() { _deckCache.clear(); }

/** A selected deck is a persisted allowlist; undefined denotes a legacy dungeon. */
export function ebeneDeck(ebene) {
  const all=deck(themaDerEbene(ebene));
  if(!Array.isArray(ebene.deckIds)) return [...all.values()];
  return ebene.deckIds.map(id=>{
    const card=all.get(id);
    if(!card)throw new GeneratorFehler("gespeicherte Karte fehlt: "+id);
    return card;
  });
}
export function karteHolen(thema, kartenId) {
  return deck(thema).get(kartenId) || null;
}

/* ------------------------------------------------------------------ */
/* Dungeon-Struktur                                                     */
/* ------------------------------------------------------------------ */

let _dungeonZaehler = 0;

/** Neue eindeutige Dungeon-Id (zeitbasiert + Zähler). */
export function dungeonId() {
  _dungeonZaehler += 1;
  return `dungeon-${Date.now().toString(36)}-${_dungeonZaehler.toString(36)}`;
}

/**
 * Neue Ebene anlegen.
 */
export function neueEbene(nr, seed) {
  return {
    nr,
    seed,
    karten: new Map(),
    anker: new Map(),
    naechstePlacementId: 1,
    zugNummer: 0,
    abgeschlossen: new Set(),
  };
}

const ankerKey = (placementId, tuerIndex) => `${placementId}:${tuerIndex}`;

/** Freie (unbenutzte, nicht abgeschlossene) Anker einer Ebene. */
export function freieAnker(ebene) {
  return [...ebene.anker.values()].filter(
    (a) => a.frei && !ebene.abgeschlossen.has(a.id)
  );
}

/** Thema einer Ebene ermitteln (ebene.thema oder via Dungeon). */
export function themaDerEbene(ebene) {
  if (ebene.thema) return ebene.thema;
  // Fallback über die erste Karte (serialisierte Ebenen ohne thema-Feld).
  const p = [...ebene.karten.values()][0];
  return p?.thema ?? null;
}

/* ------------------------------------------------------------------ */
/* Ausdehnung / Limits                                                  */
/* ------------------------------------------------------------------ */

/** Aktuelle Bounding-Box aller platzierten Karten einer Ebene. */
export function ausdehnung(ebene) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ebene.karten.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.karteBreite);
    maxY = Math.max(maxY, p.y + p.karteHoehe);
  }
  if (ebene.karten.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, breite: 0, hoehe: 0 };
  }
  return { minX, minY, maxX, maxY, breite: maxX - minX, hoehe: maxY - minY };
}

/**
 * Prüfen, ob eine Karte an (x, y) platziert werden darf, ohne die
 * maximale Ausdehnung oder das Kartenlimit zu verletzen.
 */
export function platzierungErlaubt(ebene, limits, x, y, breite, hoehe) {
  if (ebene.karten.size >= limits.maxKartenProEbene) return false;
  const box = ausdehnung(ebene);
  const nMinX = Math.min(box.minX, x);
  const nMinY = Math.min(box.minY, y);
  const nMaxX = Math.max(box.maxX, x + breite);
  const nMaxY = Math.max(box.maxY, y + hoehe);
  if (nMaxX - nMinX > limits.maxAusdehnung.breite) return false;
  if (nMaxY - nMinY > limits.maxAusdehnung.hoehe) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Kollision                                                            */
/* ------------------------------------------------------------------ */

/**
 * Kollisionsprüfung: Boden-Zellen der neuen Karte dürfen keine bereits
 * belegten Boden-Zellen überlappen. Fels überlappt erlaubt.
 */
export function kollidiert(ebene, karte, x, y) {
  const belegt = _belegteZellen(ebene);
  for (let yy = 0; yy < karte.hoehe; yy++) {
    for (let xx = 0; xx < karte.breite; xx++) {
      if (!karte.zellen[yy][xx].boden) continue;
      if (belegt.has(`${x + xx},${y + yy}`)) return true;
    }
  }
  return false;
}

/** Cache der belegten Boden-Zellen je Ebene (invalidiert bei Platzierung). */
const _belegtCache = new WeakMap();
function _belegteZellen(ebene) {
  if (_belegtCache.has(ebene)) return _belegtCache.get(ebene);
  const set = new Set();
  for (const p of ebene.karten.values()) {
    const rk = kartePlacement(ebene, p);
    for (let yy = 0; yy < rk.hoehe; yy++) {
      for (let xx = 0; xx < rk.breite; xx++) {
        if (rk.zellen[yy][xx].boden) set.add(`${p.x + xx},${p.y + yy}`);
      }
    }
  }
  _belegtCache.set(ebene, set);
  return set;
}

/** Rotierte Karte eines Placements auflösen (mit Rotations-Cache). */
const _rotCache = new WeakMap();
export function kartePlacement(ebene, placement) {
  const basis = karteHolen(themaDerEbene(ebene), placement.karte);
  const rot = placement.rot ?? 0;
  if (rot === 0) return basis;
  if (!_rotCache.has(basis)) _rotCache.set(basis, new Map());
  const proKarte = _rotCache.get(basis);
  if (!proKarte.has(rot)) proKarte.set(rot, karteRotieren(basis, rot));
  return proKarte.get(rot);
}

/** Cache invalidieren (nach jeder Platzierung). */
export function _cacheInvalidieren(ebene) {
  _belegtCache.delete(ebene);
}

/* ------------------------------------------------------------------ */
/* Platzierung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Karte andocken. Die rotierte Karte wird im Placement mit `rot`
 * gespeichert; die Türen stammen aus der ROTIERTEN Karte.
 *
 * @param {object} ebene     mutierte Ebene
 * @param {object} rng       Seeded RNG
 * @param {string} kartenId  Karte (unrotiert) aus dem Deck
 * @param {number} rot       Rotation 0-3
 * @param {object|null} ziel { placementId, tuerIndex } – Ankerziel (null = Start)
 * @returns {object} placement
 */
export function kartePlatzieren(ebene, rng, kartenId, rot, ziel) {
  const basisKarte = karteHolen(themaDerEbene(ebene), kartenId);
  if (!basisKarte) throw new GeneratorFehler(`unbekannte Karte '${kartenId}'`);
  const karte = rot === 0 ? basisKarte : karteRotieren(basisKarte, rot);

  let x = 0;
  let y = 0;
  if (ziel) {
    const port = ebene.karten.get(ziel.placementId);
    if (!port) throw new GeneratorFehler(`Ziel-Placement '${ziel.placementId}' fehlt`);
    const portTuer = port.tueren[ziel.tuerIndex];
    if (!portTuer) throw new GeneratorFehler(`Ziel-Tür ${ziel.tuerIndex} fehlt`);
    const zielSeite = gegenSeite(portTuer.seite);
    const neueTuer = karte.tueren.find((t) => t.seite === zielSeite);
    if (!neueTuer) {
      throw new GeneratorFehler(
        `Karte '${kartenId}' (rot ${rot}) hat keine '${zielSeite}'-Tür`
      );
    }
    ({ x, y } = _anDockPosition(port, portTuer, karte, neueTuer));
  }

  if (kollidiert(ebene, karte, x, y)) {
    throw new GeneratorFehler(`Kollision bei (${x},${y})`);
  }

  const placement = {
    id: `k${ebene.naechstePlacementId}`,
    karte: kartenId,
    rot,
    thema: themaDerEbene(ebene),
    x,
    y,
    karteBreite: karte.breite,
    karteHoehe: karte.hoehe,
    kategorie: karte.kategorie,
    tueren: karte.tueren.map((t) => ({ ...t, ziel: null })),
  };
  ebene.naechstePlacementId += 1;
  ebene.karten.set(placement.id, placement);
  _cacheInvalidieren(ebene);

  // Türen der neuen Karte als Anker registrieren …
  karte.tueren.forEach((t, tuerIndex) => {
    const id = ankerKey(placement.id, tuerIndex);
    ebene.anker.set(id, {
      id,
      placementId: placement.id,
      tuerIndex,
      kante: tuerKante(placement, t),
      seite: t.seite,
      frei: true,
    });
  });

  // … und bei Andockung beide Seiten verbinden.
  if (ziel) {
    const port = ebene.karten.get(ziel.placementId);
    const portTuer = port.tueren[ziel.tuerIndex];
    const zielSeite = gegenSeite(portTuer.seite);
    const neueIndex = karte.tueren.findIndex((t) => t.seite === zielSeite);
    const neueTuer = placement.tueren[neueIndex];

    portTuer.ziel = { placementId: placement.id, tuerIndex: neueIndex };
    neueTuer.ziel = { placementId: port.id, tuerIndex: ziel.tuerIndex };

    const portAnker = ebene.anker.get(ankerKey(port.id, ziel.tuerIndex));
    if (portAnker) portAnker.frei = false;
    const neuerAnker = ebene.anker.get(ankerKey(placement.id, neueIndex));
    if (neuerAnker) neuerAnker.frei = false;
  }

  ebene.zugNummer += 1;
  return placement;
}

/** Andock-Position: neue Tür trifft exakt auf die Port-Tür. */
function _anDockPosition(port, portTuer, neueKarte, neueTuer) {
  const { cx, cy, seite } = portTuer;
  if (seite === "n") {
    return { x: port.x + cx - neueTuer.cx, y: port.y - neueKarte.hoehe };
  }
  if (seite === "s") {
    return { x: port.x + cx - neueTuer.cx, y: port.y + port.karteHoehe };
  }
  if (seite === "w") {
    return { x: port.x - neueKarte.breite, y: port.y + cy - neueTuer.cy };
  }
  return { x: port.x + port.karteBreite, y: port.y + cy - neueTuer.cy };
}

/* ------------------------------------------------------------------ */
/* Zug-Suche mit Rotation + Alternativkarten                            */
/* ------------------------------------------------------------------ */

/**
 * Kandidaten-Karten der Ebene: alle Karten des Themas in allen
 * Rotationen, gewichtet nach Kategorie. Treppen nur, wenn der
 * Schwellenanteil am Karten-Limit erreicht ist.
 */
export function kandidaten(ebene, limits) {
  const anteil = ebene.karten.size / limits.maxKartenProEbene;
  const treppenFaellig = anteil >= TREPPE_AB_ANTEIL && ebene.nr < limits.maxEbenen;
  const liste = [];
  for (const k of ebeneDeck(ebene)) {
    const gewicht = KATEGORIE_GEWICHTE[k.kategorie] ?? 0;
    if (k.kategorie === "treppe") {
      if (!treppenFaellig) continue;
      for (let rot = 0; rot < 4; rot++) liste.push({ karte: k, rot, gewicht: 3 });
      continue;
    }
    if (gewicht <= 0) continue;
    for (let rot = 0; rot < 4; rot++) liste.push({ karte: k, rot, gewicht });
  }
  return liste;
}

/**
 * Nächsten Zug ausführen: gewichtete Kandidaten (per RNG sortiert)
 * gegen alle freien Anker probieren, bis eine Kombination ohne
 * Kollision und ohne Limit-Verletzung passt.
 *
 * @returns {object|null} placement oder null (kein Platz mehr)
 */
export function naechsterZug(ebene, rng, limits = DEFAULT_LIMITS, ankerId = null) {
  if (ebene.karten.size >= limits.maxKartenProEbene) return null;
  const anker = freieAnker(ebene).filter(a => ankerId === null || a.id === ankerId);
  if (anker.length === 0) return null;

  const karten = kandidaten(ebene, limits);
  // Gewichtete Ziehung aller Kandidaten ohne Zurücklegen -> Versuchsfolge.
  const reihenfolge = [];
  const rest = new Map(karten.map((k, i) => [i, k]));
  while (rest.size > 0) {
    const eintraege = [...rest.entries()].map(([i, k]) => ({
      wert: i,
      gewicht: k.gewicht,
    }));
    const g = rng.pickWeighted(eintraege);
    if (!g) break;
    reihenfolge.push(rest.get(g.wert));
    rest.delete(g.wert);
  }

  for (const k of reihenfolge) {
    const rk = k.rot === 0 ? k.karte : karteRotieren(k.karte, k.rot);
    for (const a of rng.shuffle(anker)) {
      const port = ebene.karten.get(a.placementId);
      if (!port) continue;
      const portTuer = port.tueren[a.tuerIndex];
      if (!portTuer || portTuer.ziel) continue;
      const zielSeite = gegenSeite(portTuer.seite);
      const neueTuer = rk.tueren.find((t) => t.seite === zielSeite);
      if (!neueTuer) continue;
      const { x, y } = _anDockPosition(port, portTuer, rk, neueTuer);
      if (!platzierungErlaubt(ebene, limits, x, y, rk.breite, rk.hoehe)) continue;
      if (kollidiert(ebene, rk, x, y)) continue;
      return kartePlatzieren(ebene, rng, k.karte.id, k.rot, {
        placementId: a.placementId,
        tuerIndex: a.tuerIndex,
        kante: a.kante,
      });
    }
  }
  return null;
}

/**
 * Ausgänge, an denen keine Karte mehr platziert werden kann, abschließen:
 * Der Anker wird als abgeschlossen markiert – die Szene rendert dort
 * eine geschlossene Wand statt einer Tür ins Nichts.
 *
 * @returns {Array} Liste der abgeschlossenen Anker-Ids
 */
export function nichtErweiterbareAbschliessen(ebene, rng, limits = DEFAULT_LIMITS) {
  const geschlossen = [];
  for (const a of freieAnker(ebene)) {
    if (!_probeAnker(ebene, rng, limits, a)) {
      ebene.abgeschlossen.add(a.id);
      geschlossen.push(a.id);
    }
  }
  return geschlossen;
}

/** Testweise prüfen, ob an einen Anker irgendeine Karte passt. */
function _probeAnker(ebene, rng, limits, anker) {
  const karten = kandidaten(ebene, limits);
  for (const k of karten) {
    const rk = k.rot === 0 ? k.karte : karteRotieren(k.karte, k.rot);
    const port = ebene.karten.get(anker.placementId);
    const portTuer = port.tueren[anker.tuerIndex];
    const zielSeite = gegenSeite(portTuer.seite);
    const neueTuer = rk.tueren.find((t) => t.seite === zielSeite);
    if (!neueTuer) continue;
    const { x, y } = _anDockPosition(port, portTuer, rk, neueTuer);
    if (!platzierungErlaubt(ebene, limits, x, y, rk.breite, rk.hoehe)) continue;
    if (kollidiert(ebene, rk, x, y)) continue;
    return { karte: k.karte.id, rot: k.rot, x, y };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Komplette Generierung                                                */
/* ------------------------------------------------------------------ */

/**
 * Ebene komplett vorab generieren (statischer Modus): Züge, bis keine
 * mehr möglich sind; danach nicht erweiterbare Ausgänge abschließen.
 * @returns {number} Anzahl platzierte Karten.
 */
export function ebeneGenerieren(ebene, limits = DEFAULT_LIMITS, maximaleZuege = 200) {
  const rng = createRng(ebene.seed);
  let platzierungen = 0;
  for (let i = 0; i < maximaleZuege; i++) {
    if (naechsterZug(ebene, rng, limits) === null) break;
    platzierungen += 1;
  }
  nichtErweiterbareAbschliessen(ebene, rng, limits);
  return platzierungen;
}

/** Persistenter RNG-Zustand einer Ebene (für Foundry-Flags). */
export function rngZustand(ebene) {
  return { seed: ebene.seed, zuege: ebene.zugNummer };
}

/**
 * Dungeon anlegen (nur Daten): Ebene 1 mit (rotierter) Startkarte.
 * @returns {object} dungeon { id, thema, seed, limits, ebenen }
 */
export function dungeonAnlegen(thema, seed, limits = DEFAULT_LIMITS, deckIds = undefined) {
  if (!Object.prototype.hasOwnProperty.call(THEMEN, thema)) {
    throw new GeneratorFehler(`unbekanntes Thema '${thema}'`);
  }
  const id = dungeonId();
  const ebene = neueEbene(1, seed);
  ebene.thema = thema;
  if(Array.isArray(deckIds)) ebene.deckIds=[...deckIds];
  const rng = createRng(seed);
  const startKarte = ebeneDeck(ebene).find(
    (k) => k.kategorie === "eingang"
  );
  if (!startKarte) {
    throw new GeneratorFehler(`Thema '${thema}' hat keine Eingangskarte`);
  }
  const startRot = rng.int(0, 3);
  const start = karteRotieren(startKarte, startRot);
  if (start.breite > limits.maxAusdehnung.breite || start.hoehe > limits.maxAusdehnung.hoehe) throw new GeneratorFehler("Eingang überschreitet Kartenlimit");
  kartePlatzieren(ebene, rng, startKarte.id, startRot, null);
  return { id, thema, seed, limits, ebenen: [ebene] };
}