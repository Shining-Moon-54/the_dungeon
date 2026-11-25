# The Dungeon – 0.6.0-alpha.1

Entwicklungsstand, keine stabile Freigabe. Repository: https://github.com/Shining-Moon-54/the_dungeon
Branch: develop-0.6.0.

## Installation in einer separaten Testwelt

1. Foundry VTT 14: ZIP nach `Data/modules/` entpacken, sodass `Data/modules/the-dungeon/module.json` existiert.
2. Foundry neu starten, Modul in einer D&D5e-Testwelt aktivieren. Die Welt vorher sichern.
3. Als GM eine Oberwelt-/Tavernenszene öffnen. Über die Token-Werkzeuge das Dungeon-Symbol öffnen (alternativ in der Browser-Konsole `game.theDungeon.dashboard()`).
4. Dungeon anlegen, Thema, Modus, Grenzen, Gruppe, Regelsystem und Rückkehrziel wählen. Automatisch erstellte Szene prüfen. Zum Betreten in der Oberwelt die Spieler-Tokens markieren und im Dashboard „Betreten“ auswählen.
5. Türen öffnen und Räume erkunden. Treppen/Portale und Save Points über das GM-Dashboard benutzen. Spieler können über ihre Oberfläche beim GM einen Übergang anfragen.

## Enthalten

- M1/M2: Rekonstruierter Generator mit 30 Grundkarten, vier Rotationen je Karte, Ebenen, Sanktum und Save Points. Korrekturen: gezieltes Andocken an die tatsächlich geöffnete Tür, Texturen für Karten-Tiles, stabiler Szenenursprung.
- M3: Kartenpakete per JSON mit eigenem Bildpfad und ASCII-Raster, Validierung und Persistenz. Noch kein grafischer Raumeditor oder vollständiger Asset-Katalog.
- M4: Regelstandsgetrennte XP-Budgets, CR-Obergrenze, Compendium-Monstersuche, verdeckte Tokens, GM-Journale für Schätze, Fallen und 108 Rätsel (12 einzelne Rätsel und 96 Varianten dreier Logikmuster). Schätze, Fallen und Rätsel werden vom GM ausgespielt; keine automatische Belohnungsvergabe oder Prüfung der Antworten. Ohne passendes Monsterkompendium bleiben Begegnungen Vorschläge.
- M5: Vier Modi, zeitgesteuerter Umbau ungeschützter Blatträume auf nicht von Spielern betrachteten Ebenen, Reset mit Archivierung, Undo der letzten geeigneten Erweiterung. Kein Umbau besuchter Räume, Übergänge oder Räume mit Tokens. Keine automatische Zufallspatrouille.
- M6: Dialogbasierte GM-Oberfläche mit Erstellung, Verwaltung, Erweiterung, Navigation, Schutz und Reset. Spielerpanel mit GM-Anfragen; kein autonomer Spielertransfer. Ausgewählte Tokens werden vom GM bewegt. Mehrere Tokens können beim Transfer auf derselben Zielposition landen und müssen gegebenenfalls verteilt werden. Texte teilweise Englisch, Rauminhalte Deutsch.

## Prüfung

`npm test` führt die bestehenden Logiktests und 12 neue Alpha-Tests aus. Die drei echten Foundry-Integrationstests werden außerhalb von Foundry übersprungen. `npm run lint` prüft JavaScript-Syntax.

Nicht unabhängig in Foundry VTT 14 oder auf dem Pi getestet. Insbesondere Foundry-Dialoge, Dokument-Schemata, Scene-Control-Hooks, Compendium-Import und Token-Transfer benötigen einen echten Integrationstest. GitHub-Actions-Workflow für einen versionsgebundenen Alpha-Prerelease eingerichtet; die tatsächliche Veröffentlichung muss anhand des Workflow-Laufs verifiziert werden. Keine automatischen Updates zwischen Alpha-Versionen. Nicht in einer laufenden Kampagne verwenden.


## GitHub-Installationsweg

Versionierter Quellarchiv-Installationsbranch: `install-0.6.0-alpha.1`. Manifest: https://raw.githubusercontent.com/Shining-Moon-54/the_dungeon/install-0.6.0-alpha.1/module.json. Der gepackte Prerelease ist zusätzlich vorgesehen, aber erst nach erfolgreichem Actions-Lauf verfügbar. Eine Installation in Foundry selbst wurde noch nicht verifiziert.
