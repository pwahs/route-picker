# Route Picker (Demo)

Route Picker is an open source web tool for interactively selecting, previewing, and exporting custom routes from a set of waypoints and paths. It is currently under active development.

- Select waypoints and paths on a map
- Preview and edit your route
- Download your route as a GPX file

A live demo is available here:
https://pwahs.github.io/route-picker/

To combine gpx files into one, use merge_gpx.html. (TODO: Go into detail)

## Styling and Customization

The demo exposes two configuration objects:

- `PathChooser.styles`: per-tag marker and path style overrides
- `PathChooser.lineStyles`: global line style overrides for special overlays (tour and neighbors)

Set these before calling `PathChooser.loadFromUrl(...)`.

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