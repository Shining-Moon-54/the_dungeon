# The Dungeon

Ein Foundry-VTT-14-Modul für **prozedurale Karten-Deck-Dungeons**: Höhlen, Katakomben, Türme und Städte, die sich Zug für Zug aus vorgefertigten Karten-Abschnitten aufbauen – digitaler Nachbau eines physischen Kartendecks.

> **Status: 0.6.0-alpha.1 – Entwicklungsstand M3–M6, noch keine Freigabe.**

## Konzept

- **Karten-Deck statt Live-Zeichnen**: Der Dungeon besteht aus Prefab-Karten (ASCII-Grid → SVG). Beim Auslösen (z. B. Tür öffnen) zieht der Generator die nächste Karte, rotiert sie passend und dockt sie **exakt an der geöffneten Tür** an. Pro Karte entsteht nur **1 Boden-Tile + Wand-/Tür-Segmente**.
- **4 Dungeon-Modi** (Alpha): statisch, dynamisch wachsend (Standard), sich verändernd, chaotisch – Save Points & Rückweg bleiben stabil.
- **Seedbar & reproduzierbar**: Gleicher Seed + gleiche Züge = identischer Dungeon; RNG-Zustand wird persistiert und fortgesetzt.
- **D&D 5e/5.5e** (Alpha): CR-Skalierung nach DMG 2014/2024, Monster-Vorschläge aus Compendien, Loot-Tabellen, Fallen, 100+ deutsche Rätsel.
- **KI optional** (geplant): NanoGPT, OpenRouter, Ollama, LM Studio oder beliebige OpenAI-kompatible Endpunkte – niemals Voraussetzung.

## Features (Stand M1+M2)

### M1 – Fundament & Feinschliff
- Seedbarer Generator (sfc32) mit Persistenz (`getState`/`setState`)
- 30 Karten in 4 Themen (Katakomben, Höhle, Turm, Stadt)
- **Karten-Rotation** um 90°/180°/270° – jede Karte dockt an jede Türseite
- **Alternativkarten**: passt die erste Ziehung nicht (Kollision/Limit), werden alle Kandidaten durchprobiert
- Strikte **Limits**: Kartenzahl je Ebene, maximale Kartenausdehnung (vor der Platzierung geprüft)
- **Nicht erweiterbare Ausgänge** werden sinnvoll abgeschlossen (Tür → geschlossene Wand, kein Loch in der Karte)
- **Native Foundry-Walls** (Türen = Wall mit `move: DOOR`), **keine doppelten Segmente** (globales Raster statt Wand-Salat je Karte)
- **Inkrementelles Erweitern**: Sync-Diff legt nur neue Segmente/Tiles an; Token, Fog of War und **Türzustände bleiben erhalten**; Szene wächst in alle vier Richtungen
- **3 Auslöser-Modi**: vollautomatisch beim Türöffnen, GM-Bestätigungs-Dialog, manuell – plus Sperre gegen parallele Türöffnungen mehrerer Spieler (Socket)
- **Dungeon-Zustand inkl. RNG** in Szenen-Flags persistiert; jede Dungeon-Id eindeutig

### M2 – Ebenen, Treppen, Save Points
- **Mehrere Ebenen** (pro Ebene eine Szene), Ebenen-Limit konfigurierbar
- **Treppen & Portale in beide Richtungen**: beim ersten Benutzen wird die Zielebene erzeugt **inkl. Rückweg-Karte**; zweite Benutzung bleibt dieselbe Verbindung (idempotent)
- **Sanktuen** (sichere Zwischenebenen): garantiert gegnerfrei, mit Rastplatz, Händler und Teleport-Portal
- **Save Points**: Registrierung (manuell oder automatisch beim Sanktum), **Sperrstatus pro Punkt für Spieler** (GM sieht alle), Teleport-Ziel-Auflösung
- **Rückkehr zur Taverne/Oberwelt**: konfigurierbares Ziel (Szenen-Id + Koordinaten)
- Persistenz v2: Verbindungen, Save Points, Sanktue, Oberwelt, Auslöser-Modus

## Projektstruktur

```
scripts/
  rng.mjs          # seedbarer Zufallsgenerator + Persistenz (pure)
  prefabs.mjs      # Karten-Deck: Grids, Validierung, Kanten, Rotation (pure)
  generator.mjs    # Graph-Kern: Ziehen, Andocken, Kollision, Limits (pure)
  scene-builder.mjs# Raster → native Walls/Doors/Tiles, Sync-Diff, Persistenz
  levels.mjs       # Ebenen, Treppen, Portale, Verbindungen (pure)
  sanctuary.mjs    # Sanktuen & Save Points (pure)
  triggers.mjs     # Tür-Auslöser (automatisch/bestätigung/manuell)
  persistenz.mjs   # Zustand v2 (M2-Felder)
  settings.mjs     # Modul-Settings
  main.mjs         # Hooks, Socket, game.theDungeon-API
tools/
  generate-prefab-svgs.mjs   # npm run svg
  render-dungeon.mjs         # npm run render – visuelle Kontrolle
tests/                        # 81 aktive Tests + Foundry-IT (s. tests/README.md)
assets/prefabs/<thema>/      # Karten-Grafiken (SVG)
```

## Entwicklung

```bash
npm test        # 81 pure Tests (inkl. 1.040-Dungeon-Massenprüfung + Performance)
npm run svg      # Karten-Grafiken neu generieren
npm run render   # Dungeon-Übersicht rendern: node tools/render-dungeon.mjs <thema> <seed> <karten> <out.svg>
```

Test-Details (Massen-Prüfung, Foundry-v14-Integrationstests,
Screenshots, Performance-Richtwerte): [tests/README.md](tests/README.md)

## Foundry-Verwendung (GM)

1. Modul installieren/aktivieren (Foundry 14)
2. Konsole/Makro: `await game.theDungeon` – API wird beim ersten
   `dungeonErstellen` bereitgestellt:
   ```js
   const { dungeon, scene } = await dungeonErstellen({
     thema: "katakombe",          // katakombe | hoehle | turm | stadt
     ausloeser: "bestaetigung",   // automatisch | bestaetigung | manuell
     statisch: false,             // true = Ebene vorab komplett generieren
     oberwelt: { szenenId: "…" }, // Rückkehr-Ziel (Taverne)
   });
   ```
3. Spieler öffnen Türen → je Auslöser-Modus wird erweitert
4. Treppen benutzen → nächste Ebene entsteht lazily inkl. Rückweg
5. `game.theDungeon.sanktumErstellen(id)` – Sanktum anlegen
6. Save Points: `game.theDungeon.savePoints(id)` / `savePointSperren(id, spId, true)`

## Roadmap

- **M1** ✔ Fundament + Feinschliff (Rotation, Alternativkarten, Abschluss, inkrementeller Sync, Auslöser-Modi)
- **M2** ✔ Ebenen, Treppen/Portale beidseitig, Sanktuen, Save Points, Rückkehr
- **M3** Raumvorlagen-Editor, Themes als JSON, Asset-Kategorien, eigene GM-Asset-Pakete
- **M4** CR-Mathe (2014/2024), Monster-Vorschläge, Loot-Tabellen, Fallen, Rätsel-Bibliothek, Auto-Befüllung
- **M5** KI-Profile, Kompendium-Persistenz, Dashboard, Wandering Monsters, Export/Release

## License

MIT – siehe [LICENSE](LICENSE).

## GitHub-Installation (Alpha)

**Entwicklungsstand – nur in einer separaten Testwelt mit Foundry VTT 14 verwenden.**

Im Foundry-Setup unter **Add-on Modules → Install Module** diese Manifest-URL einfügen:

`https://raw.githubusercontent.com/Shining-Moon-54/the_dungeon/install-0.6.0-alpha.1/module.json`

Der versionierte Installationsbranch enthält den vollständigen Quellcode und sämtliche Karten. Das Manifest verweist auf das zugehörige GitHub-Quellarchiv; dieser Installationsweg benötigt keinen erfolgreichen Actions-Lauf. Der Branch wird für diese Version nicht weiterentwickelt. Alternativ kann das [Quellarchiv](https://github.com/Shining-Moon-54/the_dungeon/archive/refs/heads/install-0.6.0-alpha.1.zip) heruntergeladen und sein Inhalt nach `Data/modules/the-dungeon/` kopiert werden, sodass `module.json` direkt dort liegt.

Sobald der GitHub-Actions-Prerelease veröffentlicht wurde, steht zusätzlich das kompakte Installationspaket mit einem separaten [Release-Manifest](https://github.com/Shining-Moon-54/the_dungeon/releases/download/v0.6.0-alpha.1/module.json) zur Verfügung. Siehe [ALPHA-STATUS.md](ALPHA-STATUS.md) für bekannte Einschränkungen. Zukünftige Alpha-Versionen verwenden einen neuen Manifest-Link.

### Build und Release

Neue Versionen werden über einen neuen `install-<version>`-Branch veröffentlicht. GitHub Actions generiert die Karten, prüft JavaScript-Syntax und führt die Tests aus. Der Workflow erzeugt ein Laufzeit-ZIP mit `module.json` auf oberster Ebene und veröffentlicht die Manifestdatei und das ZIP als Prerelease. Bestehende Release-Tags werden nicht überschrieben.
