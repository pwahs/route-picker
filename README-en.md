# Route Picker (Demo)

Route Picker is an open source web tool for interactively selecting, previewing, and exporting custom routes from a set of waypoints and paths.

- Select waypoints and paths on a map
- Preview and edit your route
- Download your route as a GPX file

A live demo is available here:
https://pwahs.github.io/route-picker/

## Minimal Usage

You can run the demo by serving the example folder with any static web server.

Required files:

- `index.html`: page shell, library includes, and map/list containers
- `plugin.js`: PathChooser implementation
- `map.js`: map setup and data loading calls
- `data/`: at least one input file (`.xlsx` and/or `.gpx`)

Minimal steps:

1. Start a static server in this folder (for example `python -m http.server 8000`).
2. Open `http://localhost:8000` in your browser.
3. Ensure `map.js` loads at least one dataset via `PathChooser.loadFromUrl(...)`.

Minimal example:

```html
<!doctype html>
<html>
	<head>
		<meta charset="UTF-8" />
		<link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
		<script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
		<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
		<script src="plugin.js"></script>
		<style>
			#map { height: 70vh; }
			#node_list { height: 25vh; overflow: auto; border: 1px solid #ccc; }
		</style>
	</head>
	<body>
		<div id="map"></div>
		<div id="node_list"></div>
		<script>
			const map = new maplibregl.Map({
				container: 'map',
				style: 'https://tiles.openfreemap.org/styles/liberty',
				center: [13.137, 53.011],
				zoom: 10,
			});

			PathChooser.setMap(map);
			PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');
		</script>
	</body>
</html>
```

## File format for data

This tool reads two types of files:

- Excel (`.xlsx`) for waypoint locations (stops, nodes)
- GPX (`.gpx`) for route lines between waypoints

Think of it like this:

- Excel = the important points on the map
- GPX = the paths connecting those points

### 1. Excel (`.xlsx`) format for waypoints

What the importer expects:

- You can have one or more sheets.
- Each sheet name becomes a category/tag (for styling).
- In each sheet, there must be one cell with the exact text `Knotenpunkte`.
- Starting in the rows below that cell, the importer reads 3 columns:
- Column 1: waypoint name/label
- Column 2: latitude
- Column 3: longitude

Coordinate format:

- Works with numbers (for example `52.753252`)
- Also works with direction letters (for example `52.753252°N`, `13.471438°E`)
- `S` and `W` are treated as negative values automatically.

Rows are skipped when:

- label is empty
- latitude is empty
- longitude is empty
- coordinate text cannot be understood

Simple Excel example:

| Knotenpunkte | Latitude    | Longitude   |
|--------------|-------------|-------------|
| 01           | 53.0112°N   | 13.1370°E   |
| 02           | 53.0185°N   | 13.1512°E   |
| Bahnhof      | 53.0201     | 13.1604     |

### 2. GPX (`.gpx`) format for paths

You can have multiple gpx files. All tracks in a file will be styled the same way, multiple files can be stylized individually.

What the importer expects:

- One file can contain one or more tracks (`<trk>`).
- Each track must have at least 2 track points (`<trkpt lat="..." lon="...">`).
- If a track has a `<name>`, it is used as the route source name.

How GPX connects to Excel waypoints:

- For each GPX track, the first and last point are matched to the nearest waypoint.
- Matching distance is controlled by `PathChooser.config.matchThresholdMeters` (default: 50 m).
- If no waypoint is close enough, the tool creates an unofficial waypoint automatically.

Minimal GPX example:

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

### Practical tip

Load the Excel file first, then load the GPX files. This gives the GPX importer known waypoint targets to connect to.

If you have the tracks as multiple files, this repo has a tool to help you: Combine them by opening merge_gpx.html in your browser, select the input files, and export the merged output GPX.

## Styling and Customization

The demo exposes four configuration objects:

- `PathChooser.styles`: per-tag marker and path style overrides
- `PathChooser.lineStyles`: global line style overrides for special overlays (tour and neighbors)
- `PathChooser.config`: runtime behavior settings
- `PathChooser.i18n`: UI text labels (German defaults)

Set these before calling `PathChooser.loadFromUrl(...)`.

### `PathChooser.config` (runtime behavior)

Default structure:

```js
PathChooser.config = {
	matchThresholdMeters: 50,
	maxDistanceCacheSize: 10000,
};
```

Supported keys:

- `matchThresholdMeters`: max distance used when matching GPX path endpoints to existing waypoints
- `maxDistanceCacheSize`: upper bound for the in-memory distance cache (LRU)

### `PathChooser.i18n` (UI text labels)

Default structure:

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

Template variables:

- `routeFrom`: supports `{from}` and `{to}`
- `waypointsDistance`: supports `{count}` and `{distance}`

### `PathChooser.styles` (per tag)

Example:

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

Supported keys in each tag style:

- `background`: marker fill color
- `border`: marker border CSS shorthand
- `color`: marker text color
- `width`: marker width in px
- `height`: marker height in px
- `fontSize`: marker label font-size
- `shape`: `circle` or `square`
- `lineColor`: path line color for this tag
- `lineWidth`: path line width for this tag
- `lineOpacity`: path line opacity for this tag
- `opacity`: legacy alias for path opacity
- `lineDasharray`: dash pattern for this tag path lines

### `PathChooser.lineStyles` (global line groups)

`PathChooser.lineStyles` controls line groups that are not bound to a single data tag.

Default structure:

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

Supported groups and keys:

- `_default`
- `width`: fallback line width
- `opacity`: fallback line opacity

- `basePath` (all loaded GPX/XLSX paths unless overridden in `PathChooser.styles[tag]`)
- `color`: fallback line color
- `width`: fallback line width
- `opacity`: fallback line opacity
- `dasharray`: fallback dash pattern

- `tourSingle` (selected segment used once)
- `color`: line color
- `width`: line width
- `opacity`: line opacity
- `dasharray`: dash pattern

- `tourRepeat` (selected segment used multiple times)
- `primaryColor`: color for alternating primary rings
- `secondaryColor`: color for alternating secondary rings
- `baseWidthPerOccurrence`: starting width multiplier per occurrence
- `overlapAdjustment`: subtracts overlap from initial width
- `primaryShrink`: width reduction after each primary ring
- `secondaryShrink`: width reduction after each secondary ring
- `opacity`: line opacity for all repeat rings
- `dasharray`: dash pattern for repeat rings

- `candidate` (neighbor lines from the current endpoint)
- `color`: line color
- `width`: line width
- `opacity`: line opacity
- `dasharray`: dash pattern

## CSS Class Names

All HTML elements created by `plugin.js` include stable class names, so they can be styled from `index.html` (or any loaded stylesheet).

Marker elements:

- `pathchooser-marker`: outer MapLibre marker container
- `pathchooser-marker-inner`: inner marker element (label circle/square)

Reusable waypoint badges:

- `pathchooser-waypoint-badge`: base badge class (used in overlay and node list)

Overlay elements (`#pathchooser-overlay`):

- `pathchooser-overlay`: overlay root container
- `pathchooser-overlay-distance`: total distance line
- `pathchooser-overlay-current`: current waypoint row
- `pathchooser-overlay-current-label`: `Aktuell:` label
- `pathchooser-overlay-current-badge`: current waypoint badge
- `pathchooser-overlay-action`: shared class for overlay action buttons
- `pathchooser-overlay-back`: `zurück` button
- `pathchooser-overlay-reset`: `Neustart` button
- `pathchooser-overlay-neighbors`: neighbor section container
- `pathchooser-overlay-neighbors-label`: `Nächste:` label
- `pathchooser-overlay-neighbors-badges`: neighbor badge wrapper
- `pathchooser-overlay-neighbor-badge`: clickable neighbor badge
- `pathchooser-overlay-hint`: hint shown before route start

Node list elements (`#node_list`):

- `pathchooser-node-list`: node list container class (added to existing `#node_list` element)
- `pathchooser-node-item`: single route row
- `pathchooser-node-label`: left row content wrapper
- `pathchooser-node-index`: row number (`1.`, `2.`, ...)
- `pathchooser-node-badge`: waypoint badge inside list row
- `pathchooser-node-tag`: waypoint tag text (`(tag)`)
- `pathchooser-node-actions`: row action container
- `pathchooser-node-delete`: `Alles löschen` / `Ab hier löschen` button
- `pathchooser-node-reverse`: `Route umkehren` button
- `pathchooser-node-summary`: route summary container
- `pathchooser-node-summary-line`: per-tag summary line
- `pathchooser-node-preview`: preview checkbox row
- `pathchooser-node-preview-label`: preview label
- `pathchooser-node-preview-checkbox`: preview checkbox input
- `pathchooser-node-download`: `GPX herunterladen` button

Download helper:

- `pathchooser-download-link`: temporary anchor used to trigger GPX download