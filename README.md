# Route Picker (Demo)

Route Picker ist ein Open-Source-Webtool, mit dem Sie aus vorhandenen Wegpunkten und Strecken interaktiv eigene Routen auswählen, ansehen und als GPX exportieren können.

- Wegpunkte und Strecken auf der Karte auswählen
- Route in der Vorschau ansehen und bearbeiten
- Route als GPX-Datei herunterladen

Es entstand aus einem Digitalisierungsprojektes des Mittelstand-Digital Zentrum Tourismus (https://digitalzentrum-tourismus.de/) und der Brandenburgische Seenplatte GmbH (https://www.brandenburgische-seenplatte.de/).

Eine Live-Demo finden Sie hier:
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/

## Minimalbeispiel

Um dieses Projekt auf Ihrer Webseite einzubinden, benötigen Sie z.B. den folgenden HTML-Code.
Für eine alternative Methode mit mehr Anpassungsmöglichkeiten, schauen Sie sich map.js und index.html als Beispiele an.

Falls Sie Wordpress oder ähnliches verwenden, ist die Nutzung von Javascript eventuell eingeschränkt.
Hier können Lösungen dafür gefunden werden: https://www.ionos.de/digitalguide/hosting/blogs/javascript-in-wordpress-einbinden/

```html
<div id="map"></div>
<div id="node_list"></div>

<style>
	#map { height: 70vh; }
	#node_list { height: 25vh; overflow: auto; border: 1px solid #ccc; }
</style>

<link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />

<!-- Javascript startet hier -->
<script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
<script src="plugin.js"></script>

<script>
	const map = new maplibregl.Map({
		container: 'map',
		style: 'https://tiles.openfreemap.org/styles/liberty',
		center: [13.137, 53.011],
		zoom: 10,
	});
	PathChooser.setMap(map);
	PathChooser.styles['Knotenpunkte'] = {
			background: 'red',
			border: 'none',
			color: 'white',
	};
	PathChooser.styles['Radwege'] = {
		lineColor: 'red',
		lineWidth: 3,
		opacity: 0.5,
	};
	PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');
	PathChooser.loadFromUrl('./data/pfade.gpx', 'Radwege');
</script>
<!-- Javascript Ende -->
```

Benötigte Dateien:

- `plugin.js`: Die einzige Datei, die sie aus diesem Projekt brauchen. Kann wie hier angegeben über jsDelivr von github eingebunden werden, oder Sie laden sie runter und stellen Sie auf ihrem eigenen Server bereit.
- `data/GPS-Daten_Knotenpunkte.xlsx`: mindestens eine Eingabedatei, die die Knotenpunkte enthält. Im oberen Beispiel enthält die Datei ein Sheet mit Namen 'Knotenpunkte'.
- `data/pfade.gpx`: mindestens eine Eingabedatei, die die Pfade enthält. Wenn die Routen auf viele Dateien verteilt sind, können Sie sie hier kombinieren: 
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/merge_gpx.html

Außerdem werden 3 externe Dateien eingebunden, die für das zugrunde liegende Karten-Framework MapLibre und zum Lesen von XLSX Dateien benötigt werden:

```html
<link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
```

## Dateiformat der Daten

Dieses Tool liest zwei Dateitypen:

- Excel (`.xlsx`) für Wegpunkte (Haltepunkte/Knoten)
- GPX (`.gpx`) für Streckenlinien zwischen Wegpunkten

Einfach gesagt:

- Excel = wichtige Punkte auf der Karte
- GPX = Wege, die diese Punkte verbinden

### 1. Excel-Format (`.xlsx`) für Wegpunkte

Was der Import erwartet:

- Eine Datei kann ein oder mehrere Tabellenblätter enthalten.
- Der Name des Tabellenblatts wird als Kategorie/Tag verwendet (für Styling).
- In jedem Blatt muss genau der Text `Knotenpunkte` in einer Zelle stehen.
- In den Zeilen unterhalb dieser Zelle liest der Import 3 Spalten:
- Spalte 1: Wegpunkt-Name/Bezeichnung
- Spalte 2: Breitengrad
- Spalte 3: Längengrad

Koordinatenformat:

- Funktioniert mit Zahlen (z. B. `52.753252`)
- Funktioniert auch mit Himmelsrichtung (z. B. `52.753252°N`, `13.471438°E`)
- `S` und `W` werden automatisch als negative Werte behandelt.

Zeilen werden übersprungen, wenn:

- Bezeichnung leer ist
- Breitengrad leer ist
- Längengrad leer ist
- Koordinatentext nicht verstanden wird

Einfaches Excel-Beispiel:

| Knotenpunkte | Latitude    | Longitude   |
|--------------|-------------|-------------|
| 01           | 53.0112°N   | 13.1370°E   |
| 02           | 53.0185°N   | 13.1512°E   |
| Bahnhof      | 53.0201     | 13.1604     |

### 2. GPX-Format (`.gpx`) für Strecken

Sie können mehrere GPX-Dateien verwenden. Alle Tracks in einer Datei bekommen denselben Stil; mehrere Dateien können unterschiedlich gestylt werden.

Was der Import erwartet:

- Eine Datei kann einen oder mehrere Tracks (`<trk>`) enthalten.
- Jeder Track muss mindestens 2 Trackpunkte haben (`<trkpt lat="..." lon="...">`).
- Wenn ein Track einen `<name>` hat, wird dieser als Streckenquelle verwendet.

So verbindet GPX mit Excel-Wegpunkten:

- Für jeden GPX-Track werden erster und letzter Punkt dem nächstgelegenen Wegpunkt zugeordnet.
- Die Zuordnungsdistanz wird über `PathChooser.config.matchThresholdMeters` gesteuert (Standard: 50 m).
- Ist kein Wegpunkt nah genug, erstellt das Tool automatisch einen inoffiziellen Wegpunkt.

Minimales GPX-Beispiel:

```xml
<gpx version="1.1" creator="Example">
	<trk>
		<name>Sample Route</name>
		<trkseg>
			<trkpt lat="53.0112" lon="13.1370"></trkpt>
			<trkpt lat="53.0185" lon="13.1512"></trkpt>
		</trkseg>
	</trk>
</gpx>
```

### Hinweis

Laden Sie immer zuerst die Excel-Datei und danach die GPX-Dateien. So kennt der GPX-Import bereits die Wegpunkte, mit denen er verbinden soll.

Wenn Ihre Tracks auf mehrere Dateien verteilt sind, hilft ein Tool in diesem Repository: Öffnen Sie `merge_gpx.html` im Browser, wählen Sie die Eingabedateien und exportieren Sie die zusammengeführte GPX-Datei. Das Tool ist auch live unter 
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/merge_gpx.html


## Styling und Anpassung

Die folgende Anleitung detailliert, wie das Tool individual angepasst und gestylt werden kann.

Die Demo stellt vier Konfigurationsobjekte bereit:

- `PathChooser.styles`: Tag-spezifische Marker- und Streckenstile
- `PathChooser.lineStyles`: Globale Linienstile für Sonder-Overlays (Tour und Nachbarn)
- `PathChooser.config`: Laufzeitverhalten
- `PathChooser.i18n`: UI-Texte (Standard: Deutsch)

Setzen Sie diese vor dem Aufruf von `PathChooser.loadFromUrl(...)`.

### `PathChooser.config` (Laufzeitverhalten)

Standardstruktur:

```js
PathChooser.config = {
	matchThresholdMeters: 50,
	maxDistanceCacheSize: 10000,
};
```

Unterstützte Schlüssel:

- `matchThresholdMeters`: maximale Distanz für die Zuordnung von GPX-Endpunkten zu vorhandenen Wegpunkten
- `maxDistanceCacheSize`: Obergrenze für den In-Memory-Distanzcache (LRU)

### `PathChooser.i18n` (UI-Texte)

Standardstruktur:

```js
PathChooser.i18n = {
	currentWaypoint: 'Aktuell:',
	nextWaypoints: 'Nächste:',
	back: 'zurück',
	reset: 'Neustart',
	deleteAll: 'Alles löschen',
	deleteFrom: 'Ab hier löschen',
	reverse: 'Route umkehren',
	preview: 'Routenvorschau',
	download: 'GPX herunterladen',
	startHint: 'Klicke einen Wegpunkt zum Starten',
	routeFrom: 'Route von {from} nach {to}',
	waypointsDistance: '{count} Wegpunkte, {distance}',
	totalDistance: 'Gesamtlänge:',
};
```

Template-Variablen:

- `routeFrom`: unterstützt `{from}` und `{to}`
- `waypointsDistance`: unterstützt `{count}` und `{distance}`

### `PathChooser.styles` (pro Tag)

Beispiel:

```js
PathChooser.styles['My Tag'] = {
	background: '#ffffff',
	border: '2px solid #0a84ff',
	color: '#111111',
	width: 28,
	height: 28,
	fontSize: '12px',
	shape: 'circle',
	lineColor: '#0a84ff',
	lineWidth: 4,
	lineOpacity: 0.7,
	lineDasharray: [3, 2],
};
```

Unterstützte Schlüssel pro Tag-Stil:

- `background`: Füllfarbe des Markers
- `border`: CSS-Border-Shortand für den Marker
- `color`: Textfarbe des Markers
- `width`: Marker-Breite in px
- `height`: Marker-Höhe in px
- `fontSize`: Schriftgröße der Markerbeschriftung
- `shape`: `circle` oder `square`
- `lineColor`: Linienfarbe für Strecken dieses Tags
- `lineWidth`: Linienbreite für Strecken dieses Tags
- `lineOpacity`: Linientransparenz für Strecken dieses Tags
- `opacity`: Legacy-Alias für Linientransparenz
- `lineDasharray`: Strichmuster für Strecken dieses Tags

### `PathChooser.lineStyles` (globale Liniengruppen)

`PathChooser.lineStyles` steuert Liniengruppen, die nicht an einen einzelnen Datentag gebunden sind.

Standardstruktur:

```js
PathChooser.lineStyles = {
	_default: {
		width: 3,
		opacity: 0.5,
	},
	basePath: {},
	tourSingle: {
		color: '#00CC00',
		width: 6,
		opacity: 1,
	},
	tourRepeat: {
		primaryColor: '#00CC00',
		secondaryColor: '#000000',
		baseWidthPerOccurrence: 6,
		overlapAdjustment: 1,
		primaryShrink: 10,
		secondaryShrink: 2,
		opacity: 1,
	},
	candidate: {
		color: '#FF0000',
		width: 2,
		opacity: 1,
	},
};
```

Unterstützte Gruppen und Schlüssel:

- `_default`
- `width`: Fallback-Linienbreite
- `opacity`: Fallback-Linientransparenz

- `basePath` (alle geladenen GPX/XLSX-Strecken, sofern nicht durch `PathChooser.styles[tag]` überschrieben)
- `color`: Fallback-Linienfarbe
- `width`: Fallback-Linienbreite
- `opacity`: Fallback-Linientransparenz
- `dasharray`: Fallback-Strichmuster

- `tourSingle` (ausgewähltes Segment, einmal verwendet)
- `color`: Linienfarbe
- `width`: Linienbreite
- `opacity`: Linientransparenz
- `dasharray`: Strichmuster

- `tourRepeat` (ausgewähltes Segment, mehrfach verwendet)
- `primaryColor`: Farbe für abwechselnde primäre Ringe
- `secondaryColor`: Farbe für abwechselnde sekundäre Ringe
- `baseWidthPerOccurrence`: Startbreite je Vorkommen
- `overlapAdjustment`: Überlappungsabzug von der Startbreite
- `primaryShrink`: Breitenreduktion nach jedem primären Ring
- `secondaryShrink`: Breitenreduktion nach jedem sekundären Ring
- `opacity`: Linientransparenz für alle Repeat-Ringe
- `dasharray`: Strichmuster für Repeat-Ringe

- `candidate` (Nachbarlinien vom aktuellen Endpunkt)
- `color`: Linienfarbe
- `width`: Linienbreite
- `opacity`: Linientransparenz
- `dasharray`: Strichmuster

## CSS-Klassennamen

Alle HTML-Elemente, die von `plugin.js` erzeugt werden, haben stabile Klassennamen. So können sie in `index.html` (oder einem anderen Stylesheet) gezielt gestylt werden.

Marker-Elemente:

- `pathchooser-marker`: äußerer MapLibre-Marker-Container
- `pathchooser-marker-inner`: inneres Marker-Element (Beschriftung Kreis/Quadrat)

Wiederverwendbare Wegpunkt-Badges:

- `pathchooser-waypoint-badge`: Basis-Badge-Klasse (in Overlay und Knotenliste)

Overlay-Elemente (`#pathchooser-overlay`):

- `pathchooser-overlay`: Overlay-Hauptcontainer
- `pathchooser-overlay-distance`: Zeile mit Gesamtdistanz
- `pathchooser-overlay-current`: Zeile des aktuellen Wegpunkts
- `pathchooser-overlay-current-label`: Label `Aktuell:`
- `pathchooser-overlay-current-badge`: Badge des aktuellen Wegpunkts
- `pathchooser-overlay-action`: gemeinsame Klasse für Overlay-Aktionsbuttons
- `pathchooser-overlay-back`: Button `zurück`
- `pathchooser-overlay-reset`: Button `Neustart`
- `pathchooser-overlay-neighbors`: Container des Nachbarbereichs
- `pathchooser-overlay-neighbors-label`: Label `Nächste:`
- `pathchooser-overlay-neighbors-badges`: Wrapper für Nachbar-Badges
- `pathchooser-overlay-neighbor-badge`: klickbares Nachbar-Badge
- `pathchooser-overlay-hint`: Hinweis vor dem Start einer Route

Elemente der Knotenliste (`#node_list`):

- `pathchooser-node-list`: Klasse des Listencontainers (wird zum vorhandenen `#node_list` hinzugefügt)
- `pathchooser-node-item`: einzelne Routenzeile
- `pathchooser-node-label`: linker Inhalt der Zeile
- `pathchooser-node-index`: Zeilennummer (`1.`, `2.`, ...)
- `pathchooser-node-badge`: Wegpunkt-Badge in der Listenzeile
- `pathchooser-node-tag`: Wegpunkt-Tag-Text (`(tag)`)
- `pathchooser-node-actions`: Aktionscontainer der Zeile
- `pathchooser-node-delete`: Button `Alles löschen` / `Ab hier löschen`
- `pathchooser-node-reverse`: Button `Route umkehren`
- `pathchooser-node-summary`: Container der Routenzusammenfassung
- `pathchooser-node-summary-line`: Zusammenfassungszeile pro Tag
- `pathchooser-node-preview`: Zeile mit Vorschau-Checkbox
- `pathchooser-node-preview-label`: Label der Vorschau
- `pathchooser-node-preview-checkbox`: Vorschau-Checkbox
- `pathchooser-node-download`: Button `GPX herunterladen`

Download-Helfer:

- `pathchooser-download-link`: temporärer Link, der den GPX-Download auslöst
