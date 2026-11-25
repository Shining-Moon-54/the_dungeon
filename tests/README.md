# The Dungeon – Testumgebung

## Struktur

| Verzeichnis | Inhalt |
|---|---|
| `tests/*.test.mjs` | Pure Logik-Tests (`npm test`, läuft ohne Foundry) |
| `tests/visual/*.svg` | Visuelle Dungeon-Übersichten (Screenshots, s. u.) |
| `tests/foundry-integration.test.mjs` | Foundry-v14-Integrationstests (läuft nur in Foundry) |

## Pure Tests (CI / ohne Foundry)

```bash
npm test
```

Deckt ab (aktuell 81 aktive Tests):

- **rng**: Determinismus (gleicher Seed = gleiche Folge),
  Persistenz (`getState`/`setState`), Gewichte, Shuffle, Dice
- **prefabs**: Alle 30 Karten aller 4 Themen validieren
  (Grid-Längen, Zeichen, Tür am Rand), Marker-Erkennung,
  Kanten-Berechnung (Wand vs. Tür), Rotation (4×90° = Original,
  Türen wechseln die Seite korrekt)
- **generator**: Startkarte, Limits (Kartenzahl/Ausdehnung),
  Kollisionsfreiheit, wechselseitige Türverbindungen,
  Tür-Kanten fallen exakt aufeinander (Andock-Geometrie),
  Alternativkarten, Abschluss nicht erweiterbarer Ausgänge
- **scene-builder** (pure Teile): Globales Raster, keine Wände
  zwischen Boden-Zellen, Segmente auf Grid und eindeutig,
  Sync-Diff (nur neue Segmente, keine Löschung bestehender),
  Tiles (eins je Karte), Szenenmaße (alle 4 Richtungen),
  Persistenz-Runden (serialisieren -> deserialisieren -> weiter)
- **levels** (M2): Ebenen-Verwaltung, Treppen/Portale beidseitig,
  Rückwege, Idempotenz, Ebenen-Limits, Massen-Prüfung über Seeds
- **sanctuary** (M2): Sanktum gegnerfrei, Save Points
  (registrieren/sperren/teleportieren), Rückkehr zur Oberwelt
- **triggers**: Tür-Info-Lesung, Rücken-Marker auf Grid,
  Türöffnungs-Erkennung
- **integration**: alle 4 Themen (Ebene + Treppe + Sanktum +
  Persistenz-Runde), Statistik-Sanity,
  **Performance-Messung** (1.000 Dungeons; Richtwert < 10 ms/Dungeon
  für leistungsschwache Hardware – zuletzt ~0,9 ms/Dungeon)

### Massen-Prüfung (1.000+ Seeds)

`tests/massen.test.mjs` generiert **260 Seeds × 4 Themen = 1.040
Dungeons** und prüft je Dungeon:

1. Karten-Limit eingehalten
2. maximale Ausdehnung eingehalten
3. **keine Überlappung** von Boden-Zellen
4. **alle Karten erreichbar** (BFS über Türverbindungen ab Eingang)
5. **alle Türverbindungen wechselseitig** konsistent (keine
   fehlerhaften Türen)
6. genau eine Eingangskarte

## Visuelle Kontrolle (Screenshots)

```bash
node tools/render-dungeon.mjs <thema> <seed> <maxKarten> <ausgabe.svg>
```

Erzeugt eine SVG-Übersicht einer Ebene (Boden, Wände, Türen, Marker,
Karten-Rücken an freien Ankern) nach `tests/visual/`:

- `dungeon-katakombe.svg`
- `dungeon-hoehle.svg`
- `dungeon-turm.svg`
- `dungeon-stadt.svg`

## Foundry-Integrationstests

`tests/foundry-integration.test.mjs` wird **übersprungen**, solange kein
Foundry-`game`-Objekt existiert (`test.skip`). In Foundry (v14) prüft es:

1. **Szene anlegen**: Grid 100 px, Modul-Walls + Tiles vorhanden,
   keine doppelten Segmente, 1 Tile pro Karte
2. **Inkrementell**: Erweiterung legt neue Wände/Tiles dazu,
   bestehende bleiben; doppelte Sync erzeugt nichts Neues
3. **Türzustand**: eine geöffnete Tür (`ds: 1`) bleibt nach
   Synchronisierung offen

### Ausführung in Foundry

1. Foundry v14 mit geladenem Modul `the-dungeon` starten (als GM)
2. Konsole (F12): die Tests laufen automatisch beim Laden von
   `tests/foundry-integration.test.mjs`, z. B. per
   `await import("systems/…/modules/the-dungeon/tests/foundry-integration.test.mjs")`
   aus dem Modul-Verzeichnis heraus, oder durch Kopieren der Datei in
   ein eigenes Test-Modul
3. Assert-Fehler erscheinen in der Konsole

## Performance-Richtwerte

| Messung | Ziel | Zuletzt |
|---|---|---|
| 1.000 Dungeons (je ≤ 10 Karten) vollständig generieren | < 10 s | ~0,9 s |
| je Dungeon | < 10 ms | ~0,9 ms |
| Szenen-Sync (Foundry, je Karte) | < 50 ms | via Foundry-IT geprüft |

Der Generator ist reine Logik ohne Foundry-Zugriffe; Foundry-Kosten
(Wall/Tile-Erstellung) fallen nur inkrementell pro neuer Karte an.