/**
 * THE DUNGEON – Szenen-Builder (Foundry-Seite, v2).
 *
 * Übersetzt die Generator-Daten in Foundry-Dokumente: pro Ebene eine
 * Szene mit NATIVEN Wänden, Türen (Wall mit move=DOOR) und Tiles
 * (1 Boden-Tile pro Karte – kein Tile-zu-Tile-Bauen).
 *
 * M1-Feinschliff-Anforderungen, hier gelöst:
 *   - Segmente werden GLOBAL aus dem zusammengeführten Raster aller
 *     Karten berechnet: Kanten zwischen zwei Boden-Zellen entstehen
 *     GAR NICHT (keine doppelten/wilden Wände an angedockten Karten).
 *   - Türen: eine Kante = EINE Tür (beide Kartenseiten dedupliziert).
 *   - Abgeschlossene Ausgänge (nicht erweiterbar) werden als WAND
 *     gerendert – sinnveller Abschluss statt Tür ins Nichts.
 *   - Inkrementell: Diff gegen die bestehende Szene; nur neue/andre
 *     Segmente werden erstellt, obsolete Modul-Wände gelöscht.
 *     Token, Fog of War und Türzustände (offen/geschlossen) bleiben
 *     erhalten; Türen behalten ihren Zustand, solange sie Türen bleiben.
 *   - Erweiterung in alle vier Richtungen: Szene wird bei Bedarf
 *     vergrößert (nie verkleinert).
 *   - Persistenz: Dungeon-Zustand + RNG-Zustand wandern in Flags.
 *
 * Foundry-Aufrufe nur in `ebeneSyncSzene`; alles andere ist pure
 * Logik und per `node --test` abgedeckt.
 */

import { kartePlacement, ausdehnung } from "./generator.mjs";
import { Rng } from "./rng.mjs";

/** Grid: 1 Zelle = 1 Grid-Feld à 100 px (Foundry-Standard). */
export const ZELLE_IN_PX = 100;

/** Foundry-Wall-„move"-Typen (v14): 1 = Wand, 2 = Tür. */
export const MOVE_WAND = 1;
export const MOVE_TUER = 2;

/** Flag-Namen am Modul-Namespace. */
export const FLAGS = {
  DUNGEON_ID: "dungeonId",
  EBENE_NR: "ebeneNr",
  ZUSTAND: "zustand",
  KARTE: "karte",
  TUER_INDEX: "tuerIndex",
};

/** Modul-Flag-Namespace. */
export const MODUL = "the-dungeon";

/* ------------------------------------------------------------------ */
/* Globales Raster (pure)                                               */
/* ------------------------------------------------------------------ */

/**
 * Raster der Ebene zusammenführen: Zellen-Belegung + Tür-Kanten.
 *
 * @returns {{boden: Map<string,string>, tuerKanten: Map<string,object>}}
 *   boden:      "x,y" -> placementId (Boden-Zellen)
 *   tuerKanten: Kanten-Schlüssel -> { placementId, tuerIndex, geschlossen }
 *     geschlossen = true, wenn der Ausgang abgeschlossen wurde
 *     (nicht erweiterbar -> wird als Wand gerendert).
 */
export function globalesRaster(ebene) {
  const boden = new Map();
  const tuerKanten = new Map();

  for (const placement of ebene.karten.values()) {
    const karte = kartePlacement(ebene, placement);
    // Boden-Zellen.
    for (let y = 0; y < karte.hoehe; y++) {
      for (let x = 0; x < karte.breite; x++) {
        if (karte.zellen[y][x].boden) {
          boden.set(`${placement.x + x},${placement.y + y}`, placement.id);
        }
      }
    }
    // Tür-Kanten (kanonisch, dedupliziert über den Kantenschlüssel).
    karte.tueren.forEach((t, tuerIndex) => {
      const key = tuerKanteKey(placement, t);
      const ankerId = `${placement.id}:${tuerIndex}`;
      const geschlossen =
        !t.ziel && ebene.abgeschlossen?.has?.(ankerId);
      // Bereits vorhandene Kante (andere Karte der Verbindung) behält
      // ihren Status; eine geschlossene Kante bleibt geschlossen.
      const vorhanden = tuerKanten.get(key);
      if (vorhanden) {
        vorhanden.geschlossen = vorhanden.geschlossen && geschlossen;
        return;
      }
      tuerKanten.set(key, {
        placementId: placement.id,
        tuerIndex,
        geschlossen: !!geschlossen,
      });
    });
  }
  return { boden, tuerKanten };
}

/**
 * Kanonischer Kanten-Schlüssel einer platzierten Tür.
 * Kante: "gx,gy,h" = obere Kante der Zelle (gx,gy); "gx,gy,v" = linke.
 */
export function tuerKanteKey(placement, tuer) {
  const { cx, cy, seite } = tuer;
  const x = placement.x + cx;
  const y = placement.y + cy;
  if (seite === "n") return `${x},${y},h`;
  if (seite === "s") return `${x},${y + 1},h`;
  if (seite === "w") return `${x},${y},v`;
  return `${x + 1},${y},v`; // 'o'
}

/* ------------------------------------------------------------------ */
/* Gewünschte Segmente (pure)                                          */
/* ------------------------------------------------------------------ */

/** Kante -> Pixel-Segment [x1, y1, x2, y2]. */
export function kanteSegment(key) {
  const [x, y, seite] = key.split(",");
  const gx = parseInt(x, 10) * ZELLE_IN_PX;
  const gy = parseInt(y, 10) * ZELLE_IN_PX;
  return seite === "h"
    ? [gx, gy, gx + ZELLE_IN_PX, gy]
    : [gx, gy, gx, gy + ZELLE_IN_PX];
}

/**
 * Gewünschte Wand-/Tür-Segmente einer Ebene berechnen (global):
 *
 *   - Tür-Kanten -> Türen (außer geschlossen -> Wand).
 *   - Kanten zwischen Boden und Nicht-Boden (Fels oder Kartenrand)
 *     -> Wände, sofern keine Tür darauf liegt.
 *   - Kanten zwischen zwei Boden-Zellen -> NICHTS (offener Übergang;
 *     dadurch keine Doppelwände an angedockten Karten).
 *
 * @returns {{waende: Map, tueren: Map}} key -> Segmentdaten
 */
export function szenenSegmente(ebene) {
  const { boden, tuerKanten } = globalesRaster(ebene);
  const waende = new Map();
  const tueren = new Map();

  // Türen zuerst (dedupliziert); geschlossene Ausgänge -> Wand.
  for (const [key, info] of tuerKanten) {
    if (info.geschlossen) {
      waende.set(key, { c: kanteSegment(key), move: MOVE_WAND, ds: 0 });
    } else {
      tueren.set(key, {
        c: kanteSegment(key),
        move: MOVE_TUER,
        ds: 0,
        placementId: info.placementId,
        tuerIndex: info.tuerIndex,
      });
    }
  }

  // Wände: Boden-Zelle grenzt an Nicht-Boden.
  for (const zelle of boden.keys()) {
    const [x, y] = zelle.split(",").map((v) => parseInt(v, 10));
    const nachbarn = [
      { key: `${x},${y},h`, nx: x, ny: y - 1 },     // Nord
      { key: `${x},${y + 1},h`, nx: x, ny: y + 1 }, // Süd
      { key: `${x},${y},v`, nx: x - 1, ny: y },     // West
      { key: `${x + 1},${y},v`, nx: x + 1, ny: y }, // Ost
    ];
    for (const n of nachbarn) {
      if (boden.has(`${n.nx},${n.ny}`)) continue; // Boden angrenzend -> offen
      if (tuerKanten.has(n.key)) continue;        // Tür liegt auf der Kante
      if (!waende.has(n.key)) {
        waende.set(n.key, { c: kanteSegment(n.key), move: MOVE_WAND, ds: 0 });
      }
    }
  }
  return { waende, tueren };
}

/* ------------------------------------------------------------------ */
/* Sync-Plan (pure Diff)                                                */
/* ------------------------------------------------------------------ */

/**
 * Diff gewünschte Segmente gegen bestehende Modul-Wände der Szene.
 *
 * @param {object} ebene      Generator-Ebene
 * @param {Array} vorhanden   bestehende Modul-Wände:
 *   [{ id, key, move, ds }]  (key = Flag-KANTE bzw. aus Koordinaten)
 * @returns {{create: Array, delete: Array, updateDs: Array}}
 *   create: neue Walldef-Daten (Wände + Türen)
 *   delete: Wall-Ids, die verschwinden (obsolete/typgeändert)
 *   updateDs: NICHT verwendet – Türzustände bleiben automatisch,
 *            da Türen nur gelöscht werden, wenn sie keine Tür mehr sind.
 */
export function syncPlan(ebene, vorhanden) {
  const { waende, tueren } = szenenSegmente(ebene);
  const gewuenscht = new Map();
  for (const [key, s] of waende) gewuenscht.set(key, { ...s, istTuere: false });
  for (const [key, s] of tueren) gewuenscht.set(key, { ...s, istTuere: true });

  const vorhandenMap = new Map(vorhanden.map((w) => [w.key, w]));
  const create = [];
  const deleteIds = [];

  // Gewünschte Segmente: neu erstellen, wenn fehlend oder Typ geändert.
  for (const [key, s] of gewuenscht) {
    const alt = vorhandenMap.get(key);
    const altMove = alt?.move;
    if (!alt || altMove !== s.move) {
      create.push({
        c: s.c,
        move: s.move,
        ds: s.move === MOVE_TUER ? 0 : 0,
        _key: key,
        flags: {
          [MODUL]: {
            [FLAGS.KARTE]: s.istTuere ? s.placementId : null,
            ...(s.istTuere ? { [FLAGS.TUER_INDEX]: s.tuerIndex } : {}),
          },
        },
      });
      if (alt && altMove !== s.move) deleteIds.push(alt.id); // Typänderung.
    }
    // Bestehende gleiche Segmente: unverändert (Türzustand ds bleibt).
  }

  // Obsolete Segmente löschen (nur Modul-Wände).
  for (const [key, alt] of vorhandenMap) {
    if (!gewuenscht.has(key)) deleteIds.push(alt.id);
  }

  return { create, delete: [...new Set(deleteIds)] };
}

/* ------------------------------------------------------------------ */
/* Tiles (pure)                                                         */
/* ------------------------------------------------------------------ */

/**
 * Boden-Tiles für neue Karten (ein Tile pro Karte).
 * @param {object} ebene  Generator-Ebene
 * @param {Iterable} vorhandeneKartenIds  bereits gezeichnete Placement-Ids
 * @returns {Array} Tiledef-Daten
 */
export function tilePatch(ebene, vorhandeneKartenIds) {
  const vorhanden = new Set(vorhandeneKartenIds);
  const tiles = [];
  for (const placement of ebene.karten.values()) {
    if (vorhanden.has(placement.id)) continue;
    tiles.push({
      x: placement.x * ZELLE_IN_PX,
      y: placement.y * ZELLE_IN_PX,
      width: placement.karteBreite * ZELLE_IN_PX,
      height: placement.karteHoehe * ZELLE_IN_PX,
      overhead: false,
      flags: { [MODUL]: { [FLAGS.KARTE]: placement.id } },
    });
  }
  return tiles;
}

/* ------------------------------------------------------------------ */
/* Szenenmaße (pure)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Benötigte Szenenmaße (Pixel): Bounding-Box plus Rand, min. 2000 px.
 * Negative Koordinaten (Erweiterung nach links/oben) über Gesamtmaße.
 */
export function szenenMasze(ebene, pufferZellen = 10) {
  const box = ausdehnung(ebene);
  const pad = pufferZellen * ZELLE_IN_PX;
  const links = Math.min(box.minX, 0) * ZELLE_IN_PX - pad;
  const oben = Math.min(box.minY, 0) * ZELLE_IN_PX - pad;
  const rechts = Math.max(box.maxX, 0) * ZELLE_IN_PX + pad;
  const unten = Math.max(box.maxY, 0) * ZELLE_IN_PX + pad;
  return {
    width: Math.max(2000, rechts - links),
    height: Math.max(2000, unten - oben),
  };
}

/* ------------------------------------------------------------------ */
/* Persistenz (pure)                                                    */
/* ------------------------------------------------------------------ */

/** Foundry aktiv? */
export function foundryAktiv() {
  return (
    typeof globalThis.game !== "undefined" &&
    !!globalThis.game &&
    typeof globalThis.Scene !== "undefined"
  );
}

/** Eindeutige Dungeon-Id (Foundry randomID falls verfügbar). */
export function neueDungeonId() {
  if (foundryAktiv() && globalThis.foundry?.utils?.randomID) {
    return `dungeon-${globalThis.foundry.utils.randomID()}`;
  }
  return `dungeon-${Date.now().toString(36)}`;
}

/** Dungeon-Zustand (inkl. RNG) serialisieren (reine Daten). */
export function zustandSerialisieren(dungeon, rng) {
  return {
    version: 1,
    id: dungeon.id,
    thema: dungeon.thema,
    seed: dungeon.seed,
    limits: dungeon.limits,
    ausloeser: dungeon.ausloeser ?? null,
    rng: rng ? rng.getState() : null,
    ebenen: dungeon.ebenen.map((e) => ({
      nr: e.nr,
      seed: e.seed,
      thema: e.thema ?? dungeon.thema,
      ...(Array.isArray(e.deckIds)?{deckIds:[...e.deckIds]}:{}),
      zugNummer: e.zugNummer,
      naechstePlacementId: e.naechstePlacementId,
      karten: [...e.karten.values()],
      anker: [...e.anker.values()],
      abgeschlossen: [...(e.abgeschlossen ?? [])],
    })),
  };
}

/** Serialisierten Zustand wieder auflösen. */
export function zustandDeserialisieren(data) {
  if (!data || data.version !== 1) throw new Error("Unbekannter Zustand");
  const dungeon = {
    id: data.id,
    thema: data.thema,
    seed: data.seed,
    limits: data.limits,
    ausloeser: data.ausloeser ?? null,
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

/* ------------------------------------------------------------------ */
/* Foundry-Sync                                                         */
/* ------------------------------------------------------------------ */

/** Kanonischer Segment-Schlüssel eines Wall-Dokuments aus Koordinaten. */
export function wallKeyAusKoordinaten(c) {
  // Segmente liegen auf dem Grid: (x,y,x+1,y) bzw. (x,y,x,y+1).
  const [x1, y1, x2, y2] = c.map((v) => Math.round(v));
  const gx = Math.min(x1, x2) / ZELLE_IN_PX;
  const gy = Math.min(y1, y2) / ZELLE_IN_PX;
  const seite = y1 === y2 ? "h" : "v";
  return `${Math.round(gx)},${Math.round(gy)},${seite}`;
}

/**
 * Ebene als Foundry-Szene anlegen ODER inkrementell synchronisieren.
 *
 * @param {object} dungeon  Generator-Dungeon
 * @param {object} ebene    Ebene aus dungeon.ebenen
 * @param {object} optionen { name?, szenenId? }
 * @returns {Promise<{scene: Scene, neu: Array}>}
 */
// Reserve a stable origin: expanding west/north never shifts existing documents.
export function szenenOffset(dungeon) {
  return { x: (dungeon.limits.maxAusdehnung.breite + 2) * ZELLE_IN_PX,
    y: (dungeon.limits.maxAusdehnung.hoehe + 2) * ZELLE_IN_PX };
}
export function markerPixel(dungeon, marker) {
  const o = szenenOffset(dungeon); return {x: o.x + marker.x * ZELLE_IN_PX, y: o.y + marker.y * ZELLE_IN_PX};
}
export function nativeWall(data, dungeon, ebene) {
  const { _key, ...rest } = data; const o = szenenOffset(dungeon);
  return {...rest, c: rest.c.map((v,i)=>v+(i%2?o.y:o.x)),
    move: globalThis.CONST?.WALL_MOVEMENT_TYPES?.NORMAL ?? 20,
    door: data.move === MOVE_TUER ? 1 : 0, ds: 0,
    flags: {[MODUL]: {...rest.flags[MODUL], dungeonId: dungeon.id, ebeneNr: ebene.nr, segment: _key}}};
}
export async function ebeneSyncSzene(dungeon, ebene, optionen = {}) {
  if (!foundryAktiv()) throw new Error("ebeneSyncSzene benötigt Foundry");

  // 1. Szene finden oder anlegen.
  let scene = optionen.szenenId
    ? game.scenes.get(optionen.szenenId)
    : game.scenes.find(
        (s) =>
          s.getFlag(MODUL, FLAGS.DUNGEON_ID) === dungeon.id &&
          s.getFlag(MODUL, FLAGS.EBENE_NR) === ebene.nr
      );
  if (!scene) {
    const o = szenenOffset(dungeon);
    const masze = {width: o.x * 2, height: o.y * 2};
    scene = await Scene.create({
      name: optionen.name || `The Dungeon – Ebene ${ebene.nr}`,
      width: masze.width,
      height: masze.height,
      grid: { type: 1, size: ZELLE_IN_PX },
      backgroundColor: "#1a1a22",
      padding: 0, tokenVision: true,
      flags: {
        [MODUL]: { [FLAGS.DUNGEON_ID]: dungeon.id, [FLAGS.EBENE_NR]: ebene.nr },
      },
    });
  }

  // 2. Bestehende Modul-Wände einsammeln (key, move, id).
  const vorhandeneWaelle = [];
  for (const w of scene.walls) {
    const f = w.flags?.[MODUL];
    if (!f) continue; // Nur Modul-Wände verwalten wir.
    vorhandeneWaelle.push({
      id: w.id,
      key: f.segment ?? wallKeyAusKoordinaten(w.c.map((v,i)=>v-(i%2?szenenOffset(dungeon).y:szenenOffset(dungeon).x))),
      move: w.door === 1 ? MOVE_TUER : MOVE_WAND,
    });
  }

  // 3. Diff anwenden: neue Segmente erstellen, obsolete löschen.
  const plan = syncPlan(ebene, vorhandeneWaelle);
  if (plan.delete.length > 0) {
    await scene.deleteEmbeddedDocuments("Wall", plan.delete);
  }
  if (plan.create.length > 0) {
    const sauber = plan.create.map(w => nativeWall(w, dungeon, ebene));
    await scene.createEmbeddedDocuments("Wall", sauber);
  }

  // 4. Tiles: nur neue Karten.
  const vorhandeneKarten = new Set();
  for (const t of scene.tiles) {
    const k = t.flags?.[MODUL]?.[FLAGS.KARTE];
    if (k) vorhandeneKarten.add(k);
  }
  const stale = [...scene.tiles].filter(t=>t.flags?.[MODUL]?.karte && !ebene.karten.has(t.flags[MODUL].karte));
  if (stale.length) await scene.deleteEmbeddedDocuments("Tile", stale.map(t=>t.id));
  const tiles = tilePatch(ebene, vorhandeneKarten);
  if (tiles.length > 0) {
    await scene.createEmbeddedDocuments("Tile", tiles.map(t => {
      const p = ebene.karten.get(t.flags[MODUL].karte); const o = szenenOffset(dungeon);
      const k = kartePlacement(ebene, p); const src = k.asset || `modules/the-dungeon/assets/prefabs/${p.thema}/${p.karte}.svg`;
      // Pre-rotated built-in images, custom images rotate about their center.
      const builtin = !k.asset; const odd = p.rot % 2; const w = t.width, h = t.height;
      const {overhead, ...tile} = t;
      return {...tile, x: t.x + o.x + (!builtin && odd ? (w-h)/2 : 0), y: t.y + o.y + (!builtin && odd ? (h-w)/2 : 0),
        width: !builtin && odd ? h : w, height: !builtin && odd ? w : h,
        rotation: builtin ? 0 : p.rot*90, texture: {src: builtin && p.rot ? src.replace(/\.svg$/, `-r${p.rot}.svg`) : src}};
    }));
  }

  // 5. Szene bei Bedarf vergrößern (Token/Fog bleiben erhalten).
  const masze = szenenMasze(ebene);
  const update = {};
  if (masze.width > scene.width) update.width = Math.ceil(masze.width);
  if (masze.height > scene.height) update.height = Math.ceil(masze.height);
  if (Object.keys(update).length > 0) await scene.update(update);

  return { scene, neu: tiles.map((t) => t.flags[MODUL][FLAGS.KARTE]) };
}