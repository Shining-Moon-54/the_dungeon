/**
 * THE DUNGEON – Karten-Deck (Prefabs).
 *
 * Der Dungeon setzt sich zur Laufzeit aus vorgefertigten Karten-Abschnitten
 * zusammen – digitaler Nachbau eines physischen Kartendecks:
 * Jede Karte ist ein fertiges Kartenstück mit Wänden, Türen und Markern;
 * der Generator zieht Karte um Karte und legt sie passend an.
 *
 * Zeichencodex einer Karte (ASCII-Grid):
 *   '#'  Fels (kein Boden) – erzeugt an seinen Kanten Wände
 *   '.'  Boden
 *   'n' 's' 'o' 'w'  Boden am Kartenrand mit Außen-Tür auf der Kante
 *                    (n = Nord, s = Süd, o = Ost, w = West)
 *   'g'  Boden + Gegnerposition (klein)
 *   'G'  Boden + Gegnerposition (Elite/Boss)
 *   'K'  Boden + Truhe
 *   'F'  Boden + Falle
 *   'T'  Boden + Treppenpunkt (Übergang zur nächsten Ebene)
 *   'E'  Boden + Eingangspunkt (Start der Ebene)
 *
 * Pure Logik ohne Foundry-Abhängigkeiten -> mit `node --test` testbar.
 */

/** Standard-Zeichencodex zum Exportieren (Tools/Tests). */
export const ZEICHEN = {
  FELS: "#",
  BODEN: ".",
  TUER_N: "n",
  TUER_S: "s",
  TUER_O: "o",
  TUER_W: "w",
  GEGNER: "g",
  GEGNER_ELITE: "G",
  TRUHE: "K",
  FALLE: "F",
  TREPPE: "T",
  EINGANG: "E",
};

const TUER_SEITEN = new Set(["n", "s", "o", "w"]);
const MARKER = new Map([
  [ZEICHEN.GEGNER, "gegner"],
  [ZEICHEN.GEGNER_ELITE, "gegner-elite"],
  [ZEICHEN.TRUHE, "truhe"],
  [ZEICHEN.FALLE, "falle"],
  [ZEICHEN.TREPPE, "treppe"],
  [ZEICHEN.EINGANG, "eingang"],
  ["P", "portal"],
  ["R", "rast"],
  ["H", "haendler"],
]);
const BODEN_OHNE_TUER = new Set([ZEICHEN.BODEN, ...MARKER.keys()]);

/**
 * Themen (Terrain-Typen). Neue Themes kommen später als JSON hinzu (M3),
 * bis dahin wohnen die Karten hier.
 */
export const THEMEN = {
  katakombe: { name: "Katakomben", beschreibung: "Steinerne Katakomben unter der Erde." },
  hoehle: { name: "Höhle", beschreibung: "Natürliche, unregelmäßige Höhlensysteme." },
  turm: { name: "Turm", beschreibung: "Vertikale Struktur, Ebenen nach oben." },
  stadt: { name: "Stadt", beschreibung: "Straßen, Gassen und Häuser." },
};

/** Fehlerklasse für ungültige Kartendefinitionen. */
export class KartenFehler extends Error {
  constructor(kartenId, problem) {
    super(`Karte '${kartenId}': ${problem}`);
    this.name = "KartenFehler";
  }
}

/**
 * Das Karten-Deck. Pro Thema ein Satz Karten-Abschnitte.
 * kategorie: eingang | raum | gang | kreuzung | sackgasse | treppe | boss
 */
export const KARTEN = {
  katakombe: [
    {
      id: "k-eingang", name: "Eingangskammer", kategorie: "eingang",
      grid: [
        "####n#####",
        "#........#",
        "#...E....#",
        "#........#",
        "#........#",
        "##########",
      ],
    },
    {
      id: "k-raum", name: "Steinerner Wachraum", kategorie: "raum",
      grid: [
        "############",
        "#..........#",
        "#....g.....#",
        "w..........o",
        "#..........#",
        "#..........#",
        "#....K.....#",
        "#..........#",
        "############",
      ],
    },
    {
      id: "k-gang-h", name: "Korridor", kategorie: "gang",
      grid: [
        "############",
        "############",
        "w..........o",
        "############",
        "############",
      ],
    },
    {
      id: "k-gang-v", name: "Schacht", kategorie: "gang",
      grid: [
        "n....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        "s....",
      ],
    },
    {
      id: "k-kreuzung", name: "Kreuzung", kategorie: "kreuzung",
      grid: [
        "####n####",
        "####.####",
        "####.####",
        "w.......o",
        "####.####",
        "####.####",
        "####.####",
        "####s####",
      ],
    },
    {
      id: "k-treppe", name: "Treppenabgang", kategorie: "treppe",
      grid: [
        "###########",
        "#.........#",
        "#.........#",
        "#.........#",
        "#....T....#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####s#####",
      ],
    },
    {
      id: "k-sanktum", name: "Verlassene Kapelle", kategorie: "sanktum",
      grid: [
        "############",
        "#..........#",
        "#..........#",
        "#....R.....#",
        "#..........#",
        "#..P....H..#",
        "#..........#",
        "#####s######",
      ],
    },
    {
      id: "k-sackgasse", name: "Verschlammte Sackgasse", kategorie: "sackgasse",
      grid: [
        "##########",
        "##########",
        "w...K.....",
        "##########",
        "##########",
      ],
    },
    {
      id: "k-bosshalle", name: "Grabkammer", kategorie: "boss",
      grid: [
        "##############",
        "#............#",
        "#............#",
        "#....g...g...#",
        "#............#",
        "w............o",
        "#............#",
        "#.....G......#",
        "#............#",
        "#............#",
        "##############",
      ],
    },
  ],

  hoehle: [
    {
      id: "h-eingang", name: "Höhlenmund", kategorie: "eingang",
      grid: [
        "####n#####",
        "#........#",
        "#...E....#",
        "#........#",
        "##########",
      ],
    },
    {
      id: "h-kammer", name: "Feuchte Kammer", kategorie: "raum",
      grid: [
        "############",
        "##......####",
        "##......####",
        "w..........o",
        "#..........#",
        "#....g.....#",
        "#....K.....#",
        "#..........#",
        "############",
      ],
    },
    {
      id: "h-tunnel", name: "Schlängelnder Tunnel", kategorie: "gang",
      grid: [
        "#####n######",
        "#####.######",
        "#####.######",
        "w..........o",
        "######.#####",
        "######.#####",
        "######s#####",
      ],
    },
    {
      id: "h-grotte", name: "Tropfstein-Grotte", kategorie: "kreuzung",
      grid: [
        "######n######",
        "######.######",
        "w.........###",
        "#...........o",
        "#....g......#",
        "######.######",
        "######s######",
      ],
    },
    {
      id: "h-sackgasse", name: "Nische mit Nest", kategorie: "sackgasse",
      grid: [
        "##########",
        "##########",
        "w...Kg....",
        "##########",
        "##########",
      ],
    },
    {
      id: "h-sanktum", name: "Feuchte Grotte", kategorie: "sanktum",
      grid: [
        "############",
        "##......####",
        "##......####",
        "w..........#",
        "#..........#",
        "#....R.....#",
        "#..P....H..#",
        "#..........#",
        "############",
      ],
    },
    {
      id: "h-treppe", name: "Spaltenabstieg", kategorie: "treppe",
      grid: [
        "###########",
        "#.........#",
        "#...T.....#",
        "#.........#",
        "#####s#####",
      ],
    },
  ],

  turm: [
    {
      id: "t-eingang", name: "Turmeingang", kategorie: "eingang",
      grid: [
        "#####n#####",
        "#.........#",
        "#....E....#",
        "#.........#",
        "###########",
      ],
    },
    {
      id: "t-raum", name: "Runder Turmraum", kategorie: "raum",
      grid: [
        "#####n#####",
        "###.....###",
        "##.......##",
        "##.......##",
        "#....g....#",
        "#.........#",
        "##.......##",
        "###.....###",
        "#####s#####",
      ],
    },
    {
      id: "t-gang", name: "Enger Aufgang", kategorie: "gang",
      grid: [
        "n....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        ".....",
        "s....",
      ],
    },
    {
      id: "t-treppe", name: "Treppenaufgang", kategorie: "treppe",
      grid: [
        "#####n#####",
        "#.........#",
        "#....T....#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####s#####",
      ],
    },
    {
      id: "t-sackgasse", name: "Abstellkammer", kategorie: "sackgasse",
      grid: [
        "#########",
        "#..K.g..#",
        "#.......#",
        "#.......#",
        "####s####",
      ],
    },
    {
      id: "t-sanktum", name: "Turmzimmer", kategorie: "sanktum",
      grid: [
        "#####n#####",
        "#.........#",
        "#....R....#",
        "#.........#",
        "#..P....H.#",
        "#####s#####",
      ],
    },
  ],

  stadt: [
    {
      id: "s-eingang", name: "Stadttor", kategorie: "eingang",
      grid: [
        "############",
        "#..........#",
        "#....E.....#",
        "#..........#",
        "#..........#",
        "#..........#",
        "#####s######",
      ],
    },
    {
      id: "s-gasse", name: "Gasse", kategorie: "gang",
      grid: [
        "##############",
        "##############",
        "w............o",
        "##############",
        "##############",
      ],
    },
    {
      id: "s-platz", name: "Marktplatz", kategorie: "raum",
      grid: [
        "######n#######",
        "######.#######",
        "w............o",
        "#....g..K....#",
        "#............#",
        "#............#",
        "#............#",
        "#............#",
        "#............#",
        "######s#######",
      ],
    },
    {
      id: "s-haus", name: "Bürgerhaus", kategorie: "raum",
      grid: [
        "####n#####",
        "#........#",
        "#..K.....#",
        "#........#",
        "#...g....#",
        "#........#",
        "#........#",
        "##########",
      ],
    },
    {
      id: "s-kreuzung", name: "Straßenkreuzung", kategorie: "kreuzung",
      grid: [
        "####n####",
        "####.####",
        "####.####",
        "w.......o",
        "####.####",
        "####.####",
        "####.####",
        "####s####",
      ],
    },
    {
      id: "s-sackgasse", name: "Sackgasse", kategorie: "sackgasse",
      grid: [
        "##########",
        "##########",
        "w....K.g..",
        "##########",
        "##########",
      ],
    },
    {
      id: "s-treppe", name: "Kellertreppe", kategorie: "treppe",
      grid: [
        "#####n######",
        "#..........#",
        "#....T.....#",
        "#..........#",
        "#####s######",
      ],
    },
    {
      id: "s-sanktum", name: "Wirtshaus", kategorie: "sanktum",
      grid: [
        "#####n######",
        "#..........#",
        "#....R.....#",
        "#..........#",
        "#..P....H..#",
        "#..........#",
        "#####s######",
      ],
    },
  ],
};

/**
 * Karte parsen und validieren.
 * @returns {{id,name,thema,kategorie,breite,hoehe,zellen,tueren,marker}}
 *   zellen[y][x] = { boden: boolean, zeichen: string }
 *   tueren        = [{ cx, cy, seite: 'n'|'s'|'o'|'w' }]
 *   marker        = [{ art, cx, cy }]
 */
export function karteParsen(def, thema) {
  const grid = def.grid;
  if (!Array.isArray(grid) || grid.length === 0) throw new KartenFehler(def.id, "leeres Grid");
  const breite = grid[0].length;
  const hoehe = grid.length;
  const zellen = [];
  const tueren = [];
  const marker = [];

  for (let y = 0; y < hoehe; y++) {
    const zeile = grid[y];
    if (typeof zeile !== "string" || zeile.length !== breite) {
      throw new KartenFehler(def.id, `Zeile ${y} hat Länge ${zeile?.length}, erwartet ${breite}`);
    }
    const zellenZeile = [];
    for (let x = 0; x < breite; x++) {
      const zeichen = zeile[x];
      const boden = zeichen !== ZEICHEN.FELS;
      if (!boden && zeichen !== ZEICHEN.FELS) {
        throw new KartenFehler(def.id, `unbekanntes Zeichen '${zeichen}' bei (${x},${y})`);
      }
      if (boden && !BODEN_OHNE_TUER.has(zeichen) && !TUER_SEITEN.has(zeichen)) {
        throw new KartenFehler(def.id, `unbekanntes Zeichen '${zeichen}' bei (${x},${y})`);
      }
      zellenZeile.push({ boden, zeichen });

      if (boden && TUER_SEITEN.has(zeichen)) {
        const amRand =
          (zeichen === "n" && y === 0) ||
          (zeichen === "s" && y === hoehe - 1) ||
          (zeichen === "w" && x === 0) ||
          (zeichen === "o" && x === breite - 1);
        if (!amRand) {
          throw new KartenFehler(def.id, `Tür '${zeichen}' liegt nicht am Kartenrand (${x},${y})`);
        }
        tueren.push({ cx: x, cy: y, seite: zeichen });
      }
      if (boden && MARKER.has(zeichen)) {
        marker.push({ art: MARKER.get(zeichen), cx: x, cy: y });
      }
    }
    zellen.push(zellenZeile);
  }
  if (tueren.length === 0) throw new KartenFehler(def.id, "keine Tür am Kartenrand");
  return { ...def, thema, breite, hoehe, zellen, tueren, marker };
}

/** Gesamtes Deck eines Themas parsen (Map kartenId -> Karte). */
export function deckLaden(thema) {
  const defs = KARTEN[thema];
  if (!defs) throw new Error(`Unbekanntes Thema: ${thema}`);
  const deck = new Map();
  for (const def of defs) deck.set(def.id, karteParsen(def, thema));
  return deck;
}

/** Alle Themen-Ids. */
export function themenNamen() {
  return Object.keys(THEMEN);
}

/**
 * Karte um Vielfache von 90° rotieren (im Uhrzeigersinn).
 * Liefert ein NEUES Karten-Objekt mit gedrehtem Grid; Türen und
 * Marker werden auf die neuen lokalen Koordinaten abgebildet.
 *
 * Drehung um 90° im Uhrzeigersinn: Zelle (x, y) -> (H-1-y, x).
 * Dabei rotieren die Seiten: n->o, o->s, s->w, w->n.
 *
 * @param {object} karte  geparste Karte (aus karteParsen)
 * @param {number} rot    Rotation in Schritten zu 90° (0, 1, 2, 3)
 * @returns {object} neue Karte mit rotiertem Grid (gleiche Id + rot-Suffix)
 */
export function karteRotieren(karte, rot) {
  const schritte = ((rot % 4) + 4) % 4;
  if (schritte === 0) return karte;
  const SEITEN = { n: "o", o: "s", s: "w", w: "n" }; // 90° im Uhrzeigersinn

  let breite = karte.breite;
  let hoehe = karte.hoehe;
  // Grid als Zeichenmatrix kopieren.
  let grid = karte.grid.map((zeile) => [...zeile]);

  for (let i = 0; i < schritte; i++) {
    // 90° im Uhrzeigersinn: Quelle (x, y) -> Ziel (hoehe-1-y, x).
    // Ziel-Matrix hat getauschte Dimensionen: Zeilen = alte Breite,
    // Spalten = alte Höhe. Quelle läuft über [y][x] mit y in [0,hoehe),
    // x in [0,breite); Ziel-Zelle ist [zeile][spalte]:
    //   zeile = hoehe - 1 - y  (in [0, breite) – Zeilen der ZIEL-Matrix)
    //   spalte = x             (in [0, hoehe) – Spalten der ZIEL-Matrix)
    const neu = Array.from({ length: breite }, () => Array(hoehe).fill(" "));
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        const zeichen = grid[y][x];
        const istTuereSeite = ["n", "s", "o", "w"].includes(zeichen);
        // Ziel-Zelle: Zeile = x, Spalte = hoehe-1-y.
        neu[x][hoehe - 1 - y] = istTuereSeite ? SEITEN[zeichen] : zeichen;
      }
    }
    grid = neu.map((zeile) => [...zeile]);
    const tmp = breite;
    breite = hoehe;
    hoehe = tmp;
  }
  // Rotiertes Grid zurück in ein Karten-Objekt parsen (validiert automatisch).
  return karteParsen(
    {
      ...karte,
      grid: grid.map((zeile) => zeile.join("")),
    },
    karte.thema
  );
}

/** Kanonischer Schlüssel einer Kante (Grid-Zelle + Seite). */
export function kantenSchluessel(x, y, seite) {
  return `${x},${y},${seite}`;
}

/**
 * Lokale Kanten einer Karte ableiten:
 *   - Kante zwischen Boden und Fels        -> Wand
 *   - Kante zwischen Boden und Kartenrand  -> Wand, außer Tür-Zeichen -> Tür
 *   - Kante zwischen zwei Boden-Zellen      -> keine Kante (freier Übergang)
 *
 * Kanten-Bezeichnung (kanonisch):
 *   (x, y, 'h') = obere Kante der Zelle (x, y)
 *   (x, y, 'v') = linke Kante der Zelle (x, y)
 * Die untere Kante von (x, y) ist also die obere von (x, y+1),
 * die rechte Kante von (x, y) die linke von (x+1, y).
 *
 * Tür-Kanten werden zusätzlich mit der Tür-Zelle (cx, cy) angereichert.
 *
 * @returns {{waende: Map<string,{x,y,seite}>, tueren: Map<string,{x,y,seite,cx,cy}>}}
 */
export function karteKanten(karte) {
  const waende = new Map();
  const tueren = new Map();
  const wand = (x, y, seite) => {
    const key = kantenSchluessel(x, y, seite);
    if (!tueren.has(key)) waende.set(key, { x, y, seite });
  };
  const tuer = (x, y, seite, cx, cy) => {
    const key = kantenSchluessel(x, y, seite);
    waende.delete(key);
    tueren.set(key, { x, y, seite, cx, cy });
  };

  for (let y = 0; y < karte.hoehe; y++) {
    for (let x = 0; x < karte.breite; x++) {
      const z = karte.zellen[y][x];
      if (!z.boden) continue;
      const zeichen = z.zeichen;

      // Obere Kante.
      if (y === 0) {
        if (zeichen === "n") tuer(x, y, "h", x, y);
        else wand(x, y, "h");
      } else if (!karte.zellen[y - 1][x].boden) {
        wand(x, y, "h");
      }

      // Untere Kante = obere Kante von (x, y+1).
      if (y === karte.hoehe - 1) {
        if (zeichen === "s") tuer(x, y + 1, "h", x, y);
        else wand(x, y + 1, "h");
      } else if (!karte.zellen[y + 1][x].boden) {
        wand(x, y + 1, "h");
      }

      // Linke Kante.
      if (x === 0) {
        if (zeichen === "w") tuer(x, y, "v", x, y);
        else wand(x, y, "v");
      } else if (!karte.zellen[y][x - 1].boden) {
        wand(x, y, "v");
      }

      // Rechte Kante = linke Kante von (x+1, y).
      if (x === karte.breite - 1) {
        if (zeichen === "o") tuer(x + 1, y, "v", x, y);
        else wand(x + 1, y, "v");
      } else if (!karte.zellen[y][x + 1].boden) {
        wand(x + 1, y, "v");
      }
    }
  }
  return { waende, tueren };
}

/** Boden-Zellen einer Karte als lokale Liste. */
export function bodenZellen(karte) {
  const zellen = [];
  for (let y = 0; y < karte.hoehe; y++) {
    for (let x = 0; x < karte.breite; x++) {
      if (karte.zellen[y][x].boden) zellen.push({ x, y });
    }
  }
  return zellen;
}

/**
 * Globale Kante einer platierten Kartentür.
 * @returns {{x,y,seite:'h'|'v'}} – kanonische Kante (Grid-Koordinaten der Ebene).
 */
export function tuerKante(placement, tuer) {
  const { cx, cy, seite } = tuer;
  if (seite === "n") return { x: placement.x + cx, y: placement.y, seite: "h" };
  if (seite === "s") return { x: placement.x + cx, y: placement.y + tuer.cy + 1, seite: "h" };
  if (seite === "w") return { x: placement.x, y: placement.y + cy, seite: "v" };
  return { x: placement.x + tuer.cx + 1, y: placement.y + cy, seite: "v" }; // 'o'
}

/** Gegen-Seite für Verbindungen (Nord <-> Süd, West <-> Ost). */
export function gegenSeite(seite) {
  return { n: "s", s: "n", w: "o", o: "w" }[seite];
}

/**
 * Zielposition einer neuen Karte berechnen, sodass ihre Tür `neueTuer`
 * auf die Tür `portTuer` des bereits platzierten `portPlacement` trifft.
 * @returns {{x,y}} Position (linke obere Zelle) der neuen Karte.
 */
export function anDockPosition(portPlacement, portTuer, neueKarte, neueTuer) {
  const { cx, cy, seite } = portTuer;
  if (seite === "n") return { x: portPlacement.x + cx - neueTuer.cx, y: portPlacement.y - neueKarte.hoehe };
  if (seite === "s") return { x: portPlacement.x + cx - neueTuer.cx, y: portPlacement.y + portPlacement.karteHoehe };
  if (seite === "w") return { x: portPlacement.x - neueKarte.breite, y: portPlacement.y + cy - neueTuer.cy };
  return { x: portPlacement.x + portPlacement.karteBreite, y: portPlacement.y + cy - neueTuer.cy }; // 'o'
}