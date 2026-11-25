/**
 * THE DUNGEON – Prefab-Grafiken generieren.
 *
 * Erzeugt aus den ASCII-Grids in prefabs.mjs SVG-Kartenbilder unter
 * assets/prefabs/<thema>/<kartenId>.svg. Die SVGs sind bewusst schlicht
 * (Fels/Boden/Tür/Marker) – handgezeichnete Grafiken können später
 * ersatzweise unter demselben Pfad liegen (M3/M5).
 *
 * Aufruf: npm run svg
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { KARTEN, THEMEN, karteParsen, karteRotieren } from "../scripts/prefabs.mjs";

const ZELLE = 100;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Themen-Farbpaletten. */
const PALETTE = {
  katakombe: { fels: "#2b2b33", boden: "#6b5d4f", bodenRand: "#4c4238", tuere: "#a35d2b", marker: "#e0b96a" },
  hoehle: { fels: "#26302b", boden: "#57544a", bodenRand: "#3d3b34", tuere: "#a35d2b", marker: "#cfe0b6" },
  turm: { fels: "#3a3140", boden: "#7a6a63", bodenRand: "#55493f", tuere: "#a35d2b", marker: "#e6d5a3" },
  stadt: { fels: "#33302e", boden: "#8a8272", bodenRand: "#615a4e", tuere: "#a35d2b", marker: "#d9c9a8" },
};

/** Ein Kartensymbol. */
const MARKER = {
  g: "g", G: "G", K: "K", F: "F", T: "T", E: "E",
};

/** SVG für eine Karte bauen. */
function karteSvg(karte, farben) {
  const w = karte.grid[0].length * ZELLE;
  const h = karte.grid.length * ZELLE;
  const teile = [];
  teile.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`);
  teile.push(`<title>${karte.name}</title>`);
  teile.push(`<rect width="${w}" height="${h}" fill="transparent"/>`);

  karte.grid.forEach((zeile, y) => {
    [...zeile].forEach((zeichen, x) => {
      if (zeichen === "#") return;
      const px = x * ZELLE;
      const py = y * ZELLE;
      // Bodenfläche mit leichtem Rand.
      teile.push(`<rect x="${px}" y="${py}" width="${ZELLE}" height="${ZELLE}" fill="${farben.boden}" stroke="${farben.bodenRand}" stroke-width="3"/>`);
      // Tür-Markierung (offene Lücke im Rand bleibt der SVG-Tür später
      // überlassen; hier nur visuelles Signal).
      if (["n", "s", "o", "w"].includes(zeichen)) {
        teile.push(`<rect x="${px}" y="${py}" width="${ZELLE}" height="${ZELLE}" fill="${farben.tuere}" opacity="0.25"/>`);
      }
      // Marker als Text.
      if (["T", "E", "P", "R", "H"].includes(zeichen)) {
        teile.push(`<text x="${px + ZELLE / 2}" y="${py + ZELLE / 2 + 12}" text-anchor="middle" font-size="42" fill="${farben.marker}" font-family="serif">${zeichen}</text>`);
      }
    });
  });
  teile.push("</svg>");
  return teile.join("\n");
}

/** Alle Karten aller Themen schreiben. */
function generieren() {
  let count = 0;
  for (const thema of Object.keys(THEMEN)) {
    const ordner = join(ROOT, "assets", "prefabs", thema);
    mkdirSync(ordner, { recursive: true });
    const farben = PALETTE[thema] ?? PALETTE.katakombe;
    for (const karte of KARTEN[thema]) {
      const pfad = join(ordner, `${karte.id}.svg`);
      writeFileSync(pfad, karteSvg(karte, farben), "utf8");
      for(let r=1;r<4;r++) writeFileSync(join(ordner, `${karte.id}-r${r}.svg`), karteSvg(karteRotieren(karteParsen(karte,thema),r),farben));
      count+=4;
      if (!existsSync(pfad)) throw new Error(`Schreiben fehlgeschlagen: ${pfad}`);
    }
  }
  console.log(`${count} Karten-SVGs geschrieben unter assets/prefabs/`);
}

generieren();