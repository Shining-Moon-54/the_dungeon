/**
 * THE DUNGEON – Tool: Dungeon-Übersicht als SVG rendern (visuelle Kontrolle).
 *
 * Rendert Ebenen (optional mehrere Ebenen + Sanktuen) als SVG-Datei:
 *   - Bodenzellen, Wände, Türen (Farbe pro Art)
 *   - Marker (Gegner, Truhen, Treppen, Portale, Save-Points)
 *   - Karten-Rücken-Marker an freien Ankern (gestrichelt)
 *
 * Aufruf:
 *   node tools/render-dungeon.mjs [thema] [seed] [karten] [ausgabe.svg]
 *
 * Vorgabe in tests/visual: Screenshot-Suite greift auf dieselben Dateien.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng } from "../scripts/rng.mjs";
import {
  dungeonAnlegen,
  ebeneGenerieren,
  naechsterZug,
  DEFAULT_LIMITS,
} from "../scripts/generator.mjs";
import { szenenSegmente, globalesRaster } from "../scripts/scene-builder.mjs";
import { rueckenMarker } from "../scripts/triggers.mjs";
import { markerDerEbene } from "../scripts/levels.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const Z = 40; // px pro Zelle im Rendering (kleiner als Foundry)

const FARBEN = {
  boden: "#8a7a5f",
  bodenRand: "#6b5f4a",
  wand: "#3d3830",
  tuer: "#c27a3a",
  tuerOffen: "#e0a25a",
  fels: "#22201e",
};

/** Marker-Symbole. */
const MARKER_SYMBOL = {
  gegner: "⚔",
  "gegner-elite": "💀",
  truhe: "📦",
  falle: "⚠",
  treppe: "▼",
  eingang: "⌂",
  portal: "◉",
  rast: "🔥",
  haendler: "💰",
};

/** Eine Ebene als SVG-Gruppe rendern. */
function ebeneSvg(ebene, offsetX, offsetY) {
  const { boden } = globalesRaster(ebene);
  const { waende, tueren } = szenenSegmente(ebene);
  const teile = [];

  // Bodenzellen.
  for (const key of boden.keys()) {
    const [x, y] = key.split(",").map(Number);
    teile.push(
      `<rect x="${offsetX + x * Z}" y="${offsetY + y * Z}" width="${Z}" height="${Z}" fill="${FARBEN.boden}" stroke="${FARBEN.bodenRand}" stroke-width="1"/>`
    );
  }

  // Wände (dick).
  for (const s of waende.values()) {
    const [x1, y1, x2, y2] = s.c.map((v) => (v / 100) * Z);
    teile.push(
      `<line x1="${offsetX + x1}" y1="${offsetY + y1}" x2="${offsetX + x2}" y2="${offsetY + y2}" stroke="${FARBEN.wand}" stroke-width="3"/>`
    );
  }

  // Türen (orange, dünner).
  for (const s of tueren.values()) {
    const [x1, y1, x2, y2] = s.c.map((v) => (v / 100) * Z);
    teile.push(
      `<line x1="${offsetX + x1}" y1="${offsetY + y1}" x2="${offsetX + x2}" y2="${offsetY + y2}" stroke="${FARBEN.tuer}" stroke-width="2"/>`
    );
  }

  // Marker.
  for (const m of markerDerEbene(ebene)) {
    const symbol = MARKER_SYMBOL[m.art] ?? "?";
    teile.push(
      `<text x="${offsetX + m.x * Z + Z / 2}" y="${offsetY + m.y * Z + Z / 2 + 8}" text-anchor="middle" font-size="${Z * 0.6}" fill="#20242c">${symbol}</text>`
    );
  }

  // Karten-Rücken an freien Ankern (gestrichelte Umrahmung).
  for (const r of rueckenMarker(ebene)) {
    const x = (r.x / 100) * Z;
    const y = (r.y / 100) * Z;
    teile.push(
      `<rect x="${offsetX + x - 2}" y="${offsetY + y - 2}" width="4" height="4" fill="none" stroke="#c27a3a" stroke-width="2" stroke-dasharray="3,3"/>`
    );
  }

  return teile.join("\n");
}

/** Ganzen Dungeon (mehrere Ebenen) als eine SVG-Datei rendern. */
export function dungeonSvg(dungeon) {
  const teile = [];
  teile.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2000" viewBox="0 0 1400 2000">`);
  teile.push(`<rect width="1400" height="2000" fill="#1a1a22"/>`);

  let offsetY = 20;
  for (const ebene of dungeon.ebenen) {
    const box = _boxDerEbene(ebene);
    teile.push(
      `<text x="20" y="${offsetY + 14}" font-size="14" fill="#e8e0d0">Ebene ${ebene.nr}${ebene.typ === "sanctuary" ? " (Sanktum)" : ""} – ${ebene.karten.size} Karten</text>`
    );
    offsetY += 24;
    // Ebenen-Koordinaten auf positive Offsets heben:
    const offsetX = (-Math.min(box.minX, 0)) * Z + 20;
    const localY = (-Math.min(box.minY, 0)) * Z;
    teile.push(ebeneSvg(ebene, offsetX, offsetY + localY));
    offsetY += box.hoehe * Z + localY + 40;
  }

  teile.push("</svg>");
  return teile.join("\n");
}

function _boxDerEbene(ebene) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ebene.karten.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.karteBreite);
    maxY = Math.max(maxY, p.y + p.karteHoehe);
  }
  if (ebene.karten.size === 0) return { minX: 0, minY: 0, hoehe: 0 };
  return { minX, minY, hoehe: maxY - minY, breite: maxX - minX };
}

/** CLI-Einstieg. */
function main() {
  const thema = process.argv[2] ?? "katakombe";
  const seed = process.argv[3] ?? `visual-${thema}`;
  const maxKarten = Number(process.argv[4] ?? 10);
  const ausgabe = process.argv[5] ?? join(ROOT, "tests", "visual", `dungeon-${thema}.svg`);

  const dungeon = dungeonAnlegen(thema, seed, {
    ...DEFAULT_LIMITS,
    maxKartenProEbene: maxKarten,
  });
  const rng = new Rng(seed);
  const ebene = dungeon.ebenen[0];
  for (let i = 0; i < 100; i++) if (naechsterZug(ebene, rng, dungeon.limits) === null) break;
  ebeneGenerieren === undefined ? 0 : 0; // (noop)

  mkdirSync(dirname(ausgabe), { recursive: true });
  writeFileSync(ausgabe, dungeonSvg(dungeon), "utf8");
  console.log(`Dungeon-Übersicht: ${ausgabe} (${thema}, seed ${seed}, ${ebene.karten.size} Karten)`);
}

// Nur als Skript ausführen (import als Modul erlaubt Tests).
if (process.argv[1] && process.argv[1].endsWith("render-dungeon.mjs")) {
  main();
}