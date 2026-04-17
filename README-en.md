# Route Picker (Demo)

Route Picker is an open source web tool for interactively selecting, previewing, and exporting custom routes from a set of existing waypoints and paths.

- Select waypoints and paths on the map
- Preview and edit your route
- Download your route as a GPX file

It was created during a digitalization project between the Mittelstand-Digital Zentrum Tourismus (https://digitalzentrum-tourismus.de/) and the Brandenburgische Seenplatte GmbH (https://www.brandenburgische-seenplatte.de/).

A live demo is available here:
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/

## Minimal Example

To embed this project on your website, you need the following HTML code, for example.
For an alternative method with many more customization options, take a look at map.js and index.html as examples.

If you are using WordPress or something similar, the use of JavaScript may be restricted.
Solutions for this can be found here: https://www.ionos.de/digitalguide/hosting/blogs/javascript-in-wordpress-einbinden/

```html
<div id="map"></div>
<div id="node_list"></div>

<style>
	#map { height: 70vh; }
	#node_list { height: 25vh; overflow: auto; border: 1px solid #ccc; }
</style>

<link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />

<!-- Javascript starts here -->
<script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/Mittelstand-Digital-Zentrum-Tourismus/route-picker@main/plugin.js"></script>

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
<!-- Javascript ends here -->
```

Required files:

- `plugin.js`: The only file you need from this project. It can be included via jsDelivr, for example `https://cdn.jsdelivr.net/gh/Mittelstand-Digital-Zentrum-Tourismus/route-picker@main/plugin.js`, or you can download it and host it on your own server.
- `data/GPS-Daten_Knotenpunkte.xlsx`: at least one input file containing the waypoints. In the example above, the file contains a sheet named 'Knotenpunkte'.
- `data/pfade.gpx`: at least one input file containing the paths. If the routes are spread across many files, you can combine them here: 
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/merge_gpx.html

In addition, 3 external files are included, which are required for the underlying map framework MapLibre and for reading XLSX files:

```html
<link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
```
## Data File Format

This tool reads two file types:

- Excel (`.xlsx`) for waypoints (stops/nodes)
- GPX (`.gpx`) for route lines between waypoints

Simply put:

- Excel = the important points on the map
- GPX = the paths connecting those points

### 1. Excel (`.xlsx`) format for waypoints

What the importer expects:

- A file can contain one or more sheets.
- The sheet name is used as a category/tag (for styling).
- In each sheet, exactly the text `Knotenpunkte` must appear in one cell.
- In the rows below that cell, the importer reads 3 columns:
- Column 1: waypoint name/label
- Column 2: latitude
- Column 3: longitude

Coordinate format:

- Works with numbers (e.g. `52.753252`)
- Also works with direction letters (e.g. `52.753252°N`, `13.471438°E`)
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

You can use multiple GPX files. All tracks in a file will be styled the same way; multiple files can be styled individually.

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

### Note

Always load the Excel file first, then load the GPX files. This way the GPX importer already knows the waypoints it should connect to.

If your tracks are spread across multiple files, a tool in this repository can help: open `merge_gpx.html` in your browser, select the input files, and export the merged GPX file. The tool is also available live at 
https://mittelstand-digital-zentrum-tourismus.github.io/route-picker/merge_gpx.html


## Styling and Customization

The following guide details how the tool can be individually customized and styled.

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
- `fontSize`: marker label font size
- `shape`: `circle` or `square`
- `lineColor`: path line color for this tag
- `lineWidth`: path line width for this tag
- `lineOpacity`: path line opacity for this tag
- `opacity`: legacy alias for path opacity
- `lineDasharray`: dash pattern for this tag's path lines

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
- `baseWidthPerOccurrence`: starting width per occurrence
- `overlapAdjustment`: overlap subtracted from initial width
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
