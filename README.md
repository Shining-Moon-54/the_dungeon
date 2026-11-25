# The Dungeon

**Ein lebender Dungeon für Foundry Virtual Tabletop.**

Eine Taverne über einem geheimnisvollen Dungeon. Hinter jeder ungeöffneten Tür kann ein neuer Raum warten – und der Dungeon verändert sich, während die Abenteurer ihn erkunden. The Dungeon verbindet vorgefertigte Kartenabschnitte mit prozeduraler Generierung, mehreren Ebenen und D&D-5e-Spielinhalten. Die Spielleitung bestimmt, wie groß, gefährlich und wandelbar der Dungeon werden soll.

[![Foundry VTT](https://img.shields.io/badge/Foundry_VTT-v14-orange)](https://foundryvtt.com/)
[![Version](https://img.shields.io/badge/version-0.6.0--alpha.1-blue)](https://github.com/Shining-Moon-54/the_dungeon/releases/tag/v0.6.0-alpha.1)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/Shining-Moon-54/the_dungeon/blob/develop-0.6.0/LICENSE)

[Installation](#installation) · [Funktionen](#funktionen) · [Dungeon-Modi](#dungeon-modi) · [Erste Schritte](#erste-schritte) · [Roadmap](#roadmap) · [Entwicklung](#entwicklung)

> [!IMPORTANT]
> **0.6.0-alpha.1 ist eine Entwicklungs-Alpha.** Der GitHub-Release ist veröffentlicht, die erste vollständige spielbare Testfreigabe (M6) ist aber noch nicht erreicht. Installation ausschließlich in einer gesicherten, separaten Testwelt. Die Integration in einer laufenden Foundry-v14-Instanz wurde noch nicht vollständig geprüft.

## Installation

**Voraussetzungen:** Foundry VTT v14 und eine D&D5e-Welt für die regelabhängigen Funktionen. Keine kostenpflichtigen Zusatzmodule, KI-Dienste oder npm-Abhängigkeiten für den Modulbetrieb erforderlich. Für automatische Monsterbegegnungen ist ein geeignetes Monsterkompendium erforderlich.

### Über Foundry VTT (empfohlen)

1. Im Foundry-Setup **Add-on Modules → Install Module** öffnen.
2. Folgende Manifest-URL einfügen:

   ```text
   https://github.com/Shining-Moon-54/the_dungeon/releases/download/v0.6.0-alpha.1/module.json
   ```

3. Auf **Install** klicken.
4. Eine separate D&D5e-Testwelt starten und **The Dungeon** unter **Manage Modules** aktivieren.

### Manuelle Installation

1. [Installationspaket herunterladen](https://github.com/Shining-Moon-54/the_dungeon/releases/download/v0.6.0-alpha.1/the-dungeon.zip).
2. ZIP entpacken, sodass `Data/modules/the-dungeon/module.json` direkt vorhanden ist.
3. Foundry neu starten und das Modul in der Testwelt aktivieren.

[GitHub-Release v0.6.0-alpha.1](https://github.com/Shining-Moon-54/the_dungeon/releases/tag/v0.6.0-alpha.1) · [Alternatives Quellarchiv](https://github.com/Shining-Moon-54/the_dungeon/archive/refs/heads/install-0.6.0-alpha.1.zip)

Falls das Release-Manifest nicht erreichbar ist, steht das [Manifest des versionierten Installationsbranches](https://raw.githubusercontent.com/Shining-Moon-54/the_dungeon/install-0.6.0-alpha.1/module.json) zur Verfügung. Dieser alternative Installationsweg verwendet das GitHub-Quellarchiv und ist nicht in einer echten Foundry-Instanz verifiziert. Alpha-Versionen haben derzeit jeweils eine eigene Manifest-URL.

## Funktionen

### Prozedurale Dungeon-Generierung

- 30 vorgefertigte Kartenabschnitte mit vier Rotationen (120 SVG-Dateien).
- Vier Umgebungsthemen: **Katakomben, Höhlen, Türme und Städte**.
- Neue Karten werden beim Öffnen einer Tür passend rotiert und an der tatsächlich geöffneten Tür angedockt.
- Einstellbare maximale Größe, Anzahl der Karten und Ebenen; Kollisionsprüfung und alternative Karten bei Platzmangel.
- Automatische, bestätigungspflichtige oder manuelle Erweiterung.
- Seed-basierte Generierung und Speicherung des Dungeon-Zustands inklusive Zufallsgenerator.
- Inkrementelle Aktualisierung nativer Foundry-Tiles, Wände und Türen statt vollständiger Neuerstellung bei jeder Erweiterung.

### Ebenen, Treppen und Save Points

- Mehrere Ebenen mit eigenen Foundry-Szenen und konfigurierbarem Ebenenlimit.
- Treppen und Portale mit beidseitigen Verbindungen und Rückwegen.
- Sichere Zwischenebenen (Sanktuen) als Rastbereiche.
- Registrierbare und sperrbare Save Points als Teleportziele.
- Konfigurierbare Rückkehr zur Taverne oder Oberwelt.

### D&D 5e: Begegnungen und Rauminhalte (Alpha)

- Unterschiedliche XP-Budgets für die Regelstände 2014 und 2024 sowie CR-Obergrenzen.
- Monstersuche in Kompendien und Platzierung verdeckter Tokens.
- Schätze, Fallen und Rätsel als GM-Journalinhalte.
- 108 Rätsel-Einträge: 12 einzelne Rätsel und 96 Varianten dreier Logikmuster.

Schätze, Fallen und Rätsel werden derzeit von der Spielleitung ausgespielt. Automatische Belohnungsvergabe und Antwortprüfung sind noch nicht implementiert.

### Kartenpakete und Bedienung (Alpha)

- Eigene Kartenpakete per JSON mit Bildpfad und ASCII-Raster.
- Validierung und Speicherung importierter Vorlagen.
- GM-Dashboard für Erstellung, Verwaltung, Erweiterung, Navigation, Schutz und Reset.
- Spielerpanel für Übergangsanfragen an die Spielleitung.

Ein grafischer Raumeditor und autonome Spielerübergänge sind noch nicht verfügbar.

## Dungeon-Modi

| Modus | Konzept |
| --- | --- |
| Statisch | Eine Ebene wird vorab erzeugt und bleibt grundsätzlich unverändert. |
| Dynamisch wachsend | Neue Räume entstehen beim Erkunden; Standardmodus. |
| Sich verändernd | Der Dungeon kann geeignete Bereiche zeitgesteuert umbauen. |
| Chaotisch | Stärker wandelbare Dungeon-Variante; die Grundmechanik ist vorhanden, der Modus wird weiter ausgebaut. |

Die Alpha schützt besuchte Räume, Übergänge und Räume mit Tokens vor dem automatischen Umbau. Umbauten erfolgen derzeit nur in geeigneten ungeschützten Blatträumen auf Ebenen, die nicht von Spielern betrachtet werden. Reset mit Archivierung und Rückgängig-Funktion für geeignete Erweiterungen sind vorhanden.

## Erste Schritte

1. Als GM die Szene der Taverne oder Oberwelt öffnen.
2. Über die Token-Werkzeuge das Dungeon-Symbol öffnen. Alternativ die Browser-Konsole verwenden:

   ```js
   game.theDungeon.dashboard();
   ```

3. Einen Dungeon anlegen. Thema, Modus, Grenzen, Gruppenzusammensetzung, Regelstand und Rückkehrziel festlegen.
4. Generierte Dungeon-Szene überprüfen.
5. Spieler-Tokens in der Oberwelt auswählen und im Dashboard **Betreten** verwenden.
6. Türen öffnen und den Dungeon erkunden. Die Spielleitung steuert Ebenenwechsel, Portale und Save Points über das Dashboard.

Spieler können Übergänge anfragen; der GM führt den Transfer aus. Mehrere Tokens können aktuell dieselbe Zielposition erhalten und müssen gegebenenfalls verteilt werden.

## Roadmap

| Meilenstein | Inhalt | Status |
| --- | --- | --- |
| M1 | Generator, Kartenrotation, Andocken, Limits und Persistenz | Implementiert |
| M2 | Ebenen, Treppen, Portale, Sanktuen und Save Points | Implementiert |
| M3 | Eigene Kartenpakete, grafischer Raumeditor und Asset-Katalog | Teilweise implementiert |
| M4 | CR-/XP-Skalierung, Monster, Loot, Fallen und Rätsel | Grundfunktionen implementiert |
| M5 | Vier Dungeon-Modi, Umbau, Reset und weitere Dungeon-Ereignisse | Grundfunktionen implementiert |
| M6 | Vollständige GM-/Spieleroberfläche und spielbarer Ablauf | In Entwicklung |
| M7 | Optionale KI-Anbindung, z. B. OpenAI-kompatible Endpunkte | Geplant |
| M8 | Integrationstests, Performance-Optimierung und Release | Geplant |

**Nächstes Ziel:** M6 vollständig abschließen und den ersten zusammenhängenden Spieltest in Foundry ermöglichen. KI bleibt optional und ist keine Voraussetzung für die Nutzung des Moduls.

## Entwicklung

**Entwicklungsstand nach Alpha.1:** Eine durchsuchbare Kartenbibliothek, pro Dungeon gespeicherte Deck-Auswahl und neue Ankunftsräume für tieferliegende Ebenen sind hinzugekommen. Im Entwicklungsbranch wird ein grafischer Raster-Raumeditor mit Kartenbildauswahl, mehreren Karten je Paket, Validierung, JSON-Vorschau und Versionierung eigener Pakete ergänzt. Siehe [Raumeditor-Dokumentation](https://github.com/Shining-Moon-54/the_dungeon/blob/develop-0.6.0/docs/ROOM-EDITOR.md). Nicht Bestandteil des bereits veröffentlichten Alpha.1-Releases.

Der aktuelle Quellcode liegt im [Entwicklungsbranch `develop-0.6.0`](https://github.com/Shining-Moon-54/the_dungeon/tree/develop-0.6.0). Versionierte Installationsbranches und GitHub-Releases sichern veröffentlichte Alpha-Stände.

```bash
git clone --branch develop-0.6.0 https://github.com/Shining-Moon-54/the_dungeon.git
cd the_dungeon
npm run svg
npm run lint
npm test
```

### Projektstruktur

| Ordner / Datei | Aufgabe |
| --- | --- |
| `scripts/` | Generator, Karten, Persistenz, Foundry-Integration, Begegnungen und Oberfläche |
| `assets/prefabs/` | Karten-SVGs und Rotationsvarianten |
| `styles/` | Benutzeroberfläche |
| `lang/` | Sprachdateien |
| `tools/` | Kartengenerierung und Rendering |
| `tests/` | Logik-, visuelle und Foundry-Integrationstests |
| `module.json` | Foundry-Modulmanifest |

GitHub Actions führt die Syntaxprüfung und automatisierten Tests aus und erstellt das Installationspaket für versionierte Alpha-Releases. Bestehende Release-Tags werden nicht überschrieben.

### Qualität und bekannte Einschränkungen

- Letzter dokumentierter lokaler Teststand: **93 bestanden, 0 fehlgeschlagen, 3 Foundry-Integrationstests übersprungen**.
- Die [GitHub-Actions-Builds](https://github.com/Shining-Moon-54/the_dungeon/actions) der veröffentlichten Alpha sind erfolgreich abgeschlossen.
- Ein echter Foundry-v14-Spieltest und Leistungstest auf dem Raspberry Pi 5 stehen noch aus.
- Die Oberfläche ist noch nicht vollständig lokalisiert; deutsche Rauminhalte und teilweise englische Oberflächentexte sind vorhanden.
- Details: [Alpha-Status](https://github.com/Shining-Moon-54/the_dungeon/blob/develop-0.6.0/ALPHA-STATUS.md) und [Testdokumentation](https://github.com/Shining-Moon-54/the_dungeon/blob/develop-0.6.0/tests/README.md).

## Fehler melden und Ideen einreichen

Bitte nutze [GitHub Issues](https://github.com/Shining-Moon-54/the_dungeon/issues). Bei Fehlern helfen Foundry-Version, D&D5e-Systemversion, Modulversion, Dungeon-Seed, Schritte zur Reproduktion und relevante Konsolenausgaben.

## English summary

The Dungeon is an in-development Foundry VTT v14 module for procedural, multi-level dungeons assembled from reusable map prefabs. It includes door-triggered expansion, four dungeon modes, save points, configurable D&D 5e encounter budgets, room contents and an initial GM dashboard. The current release is an early development alpha, not yet ready for live campaigns.

## Lizenz

MIT – siehe [LICENSE](https://github.com/Shining-Moon-54/the_dungeon/blob/develop-0.6.0/LICENSE).

Entwickelt von **Shining-Moon-54**. Ein unabhängiges Community-Projekt für Foundry Virtual Tabletop.
