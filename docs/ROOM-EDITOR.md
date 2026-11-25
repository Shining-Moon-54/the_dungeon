# Raumeditor (M3, Entwicklungsbranch)

Der Raumeditor ist über **The Dungeon → Raumeditor** für GM verfügbar. Die veröffentlichte Alpha.1 enthält diese Erweiterung noch nicht.

1. Paket-ID und Thema auswählen. Eine Paket-ID kann nur einmal gespeichert werden.
2. Karten-ID, Namen und Kategorie angeben. Weitere Karten lassen sich über **Karte +** ergänzen.
3. Ein Bild über Foundrys Dateiauswahl wählen. Das Bild sollte exakt das Rasterverhältnis besitzen (100 px pro Rasterfeld); der Dungeon verwendet die vollständige Bildfläche.
4. Rastergröße 3–40 einstellen. Bestehende Bodenflächen werden beim Verkleinern nicht stillschweigend abgeschnitten. Ost-/Südtüren müssen vor einer Änderung der entsprechenden Kante entfernt werden.
5. Pinsel wählen und Rasterzellen anklicken oder mit gedrückter linker Maustaste übermalen. Türen sind nur an ihrer passenden Außenkante zulässig. Wände werden aus Fels/Boden-Kanten abgeleitet, nicht frei gezeichnet.
6. Bei Bedarf Undo verwenden (bis 100 Änderungen an der aktuellen Karte). Bildvorschau und JSON-Ausgabe sind verfügbar.
7. **Paket speichern** ist nur bei gültigem Gesamtpaket möglich. Karten müssen mindestens eine Außentür und eine zusammenhängende Bodenfläche besitzen.
8. Vorhandene Pakete über **Als Entwurf kopieren** unter neuer ID versionieren. Alte Pakete bleiben für bestehende Dungeon-Speicherstände verfügbar. Keine automatische Migration laufender Dungeons.

Der JSON-Import bleibt zusätzlich verfügbar. Ein separater Asset-Katalog, eigene Themen und die tatsächliche Bedienprüfung in Foundry v14 sind noch offen. Kartenbilder werden nicht in das Paket eingebettet; sie müssen für alle Spieler auf dem Foundry-Server erreichbar sein.
