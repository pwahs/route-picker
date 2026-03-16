// ── PathChooser data layer ──────────────────────────────────────────
window.PathChooser = window.PathChooser || {};

// ── Configuration ──────────────────────────────────────────────────
const MATCH_THRESHOLD_METERS = 10;

// ── Helpers ────────────────────────────────────────────────────────

/** Haversine distance between two [lng, lat] pairs, in metres. */
function distanceMeters(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6_371_000; // earth radius in metres
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
        sinLat * sinLat +
        Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

let _nextWaypointId = 1;
let _nextPathId = 1;
let _unofficialCounter = 1;

// ── Data structures ────────────────────────────────────────────────

/**
 * @typedef {Object} Waypoint
 * @property {string}  id     – unique identifier (e.g. "w1", "w2", …)
 * @property {string}  label  – short display name
 * @property {string}  tag    – style key ("station", "summit", "unofficial", …)
 * @property {number[]} coords – [lng, lat]
 */

/**
 * @typedef {Object} Path
 * @property {string}   id              – unique identifier (e.g. "p1", "p2", …)
 * @property {string}   startWaypointId – reference into waypoints map
 * @property {string}   endWaypointId   – reference into waypoints map
 * @property {string}   tag             – style key ("hiking", "biking", "skiing", …)
 * @property {number[][]} trackPoints   – array of [lng, lat] forming the full track
 * @property {string}   source          – origin filename / URL
 */

// ── Store ──────────────────────────────────────────────────────────

class PathChooserStore {
    constructor() {
        /** @type {Map<string, Waypoint>} */
        this.waypoints = new Map();

        /** @type {Map<string, Path>} */
        this.paths = new Map();

        /**
         * Adjacency index: waypointId → [{ neighborId, pathId }, …]
         * Bidirectional – every path produces an entry on both ends.
         * @type {Map<string, Array<{neighborId: string, pathId: string}>>}
         */
        this.adjacency = new Map();
    }

    // ── Waypoints ──────────────────────────────────────────────────

    /**
     * Add a waypoint to the store.
     * @param {string} label
     * @param {string} tag
     * @param {number[]} coords  [lng, lat]
     * @returns {Waypoint} the created waypoint
     */
    addWaypoint(label, tag, coords) {
        const id = 'w' + _nextWaypointId++;
        const waypoint = { id, label, tag, coords };
        this.waypoints.set(id, waypoint);
        this.adjacency.set(id, []);
        return waypoint;
    }

    /**
     * Find the nearest existing waypoint within MATCH_THRESHOLD_METERS.
     * @param {number[]} coords  [lng, lat]
     * @returns {Waypoint|null}
     */
    findNearestWaypoint(coords) {
        let best = null;
        let bestDist = Infinity;
        for (const wp of this.waypoints.values()) {
            const d = distanceMeters(coords, wp.coords);
            if (d < bestDist) {
                bestDist = d;
                best = wp;
            }
        }
        return bestDist <= MATCH_THRESHOLD_METERS ? best : null;
    }

    /**
     * Resolve a coordinate to an existing waypoint or create an "unofficial" one.
     * @param {number[]} coords [lng, lat]
     * @returns {Waypoint}
     */
    resolveWaypoint(coords) {
        const existing = this.findNearestWaypoint(coords);
        if (existing) return existing;
        return this.addWaypoint('U' + _unofficialCounter++, 'unofficial', coords);
    }

    // ── Paths ──────────────────────────────────────────────────────

    /**
     * Add a path between two waypoints.
     * @param {string} startWaypointId
     * @param {string} endWaypointId
     * @param {string} tag  style key ("hiking", "biking", "skiing", …)
     * @param {number[][]} trackPoints  array of [lng, lat]
     * @param {string} source  origin filename / URL
     * @returns {Path}
     */
    addPath(startWaypointId, endWaypointId, tag, trackPoints, source) {
        const id = 'p' + _nextPathId++;
        const path = { id, startWaypointId, endWaypointId, tag, trackPoints, source };
        this.paths.set(id, path);

        // Bidirectional adjacency
        this.adjacency.get(startWaypointId).push({ neighborId: endWaypointId, pathId: id });
        this.adjacency.get(endWaypointId).push({ neighborId: startWaypointId, pathId: id });
        return path;
    }

    // ── Queries ────────────────────────────────────────────────────

    /**
     * Get all neighbours and connecting paths for a waypoint.
     * @param {string} waypointId
     * @returns {Array<{neighbor: Waypoint, path: Path}>}
     */
    getNeighbors(waypointId) {
        const edges = this.adjacency.get(waypointId) || [];
        return edges.map(({ neighborId, pathId }) => ({
            neighbor: this.waypoints.get(neighborId),
            path: this.paths.get(pathId),
        }));
    }
}

// ── Singleton store ────────────────────────────────────────────────
const store = new PathChooserStore();
window.PathChooser.store = store;

// ── Loading (dummy) ────────────────────────────────────────────────

/**
 * Load waypoints and paths from a URL.
 *
 * TODO: implement actual GPX/GeoJSON parsing.
 * For now this is a placeholder that logs the URL and returns the store.
 *
 * Expected behaviour once implemented:
 * 1. Fetch the file at `url`.
 * 2. Parse waypoints → call store.addWaypoint(label, tag, coords) for each.
 * 3. Parse tracks  → for each track, resolve start/end via
 *    store.resolveWaypoint(coords), then call
 *    store.addPath(startId, endId, tag, trackPoints, url).
 *
 * @param {string} url  URL to a GPX (or other) file
 * @returns {Promise<PathChooserStore>}
 */
window.PathChooser.loadFromUrl = async function (url) {
    console.log(`[PathChooser] loadFromUrl called with: ${url}`);

    if (url.toLowerCase().endsWith('.xlsx')) {
        await loadFromXlsx(url);
    }

    return store;
};

/**
 * Fetch an xlsx file and parse waypoints from it.
 *
 * Sheet layout per sheet:
 * - Sheet name → waypoint tag
 * - Find the cell containing "Knotenpunkte"
 * - The column underneath holds waypoint labels
 * - The next column holds latitude strings, e.g. "52.753252°N"
 * - The column after that holds longitude strings, e.g. "13.471438°E"
 *
 * @param {string} url
 * @returns {Promise<void>}
 */
async function loadFromXlsx(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`[PathChooser] Failed to fetch ${url}: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[PathChooser] Fetched ${url} (${arrayBuffer.byteLength} bytes)`);
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    console.log(`[PathChooser] Sheets found: ${workbook.SheetNames.join(', ')}`);

    for (const sheetName of workbook.SheetNames) {
        const tag = sheetName;
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        // Find the row and column of the "Knotenpunkte" header cell
        let headerRow = -1;
        let headerCol = -1;
        outer: for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                if (typeof rows[r][c] === 'string' && rows[r][c].trim() === 'Knotenpunkte') {
                    headerRow = r;
                    headerCol = c;
                    break outer;
                }
            }
        }

        if (headerRow === -1) {
            console.warn(`[PathChooser] No "Knotenpunkte" cell found in sheet "${sheetName}", skipping.`);
            continue;
        }

        console.log(`[PathChooser] Sheet "${sheetName}": found "Knotenpunkte" at row ${headerRow}, col ${headerCol}`);

        // Rows below the header: label | lat | lng
        for (let r = headerRow + 1; r < rows.length; r++) {
            const row = rows[r];
            const label = row[headerCol];
            const latStr = row[headerCol + 1];
            const lngStr = row[headerCol + 2];

            if (!label || !latStr || !lngStr) continue;

            const lat = parseCoordinate(latStr);
            const lng = parseCoordinate(lngStr);

            if (lat === null || lng === null) {
                console.warn(`[PathChooser] Could not parse coordinates for "${label}" in sheet "${sheetName}": ${latStr}, ${lngStr}`);
                continue;
            }

            const wp = store.addWaypoint(String(label).trim(), tag, [lng, lat]);
            console.log(`[PathChooser]   + ${wp.id} "${wp.label}" [${lng}, ${lat}] tag=${tag}`);
        }
    }

    console.log(`[PathChooser] Done loading xlsx. Total waypoints: ${store.waypoints.size}`);
}

// ── Map display ────────────────────────────────────────────────────

/**
 * Add all waypoints from the store to a MapLibre map as circle + label layers.
 * Waits for the map style to be loaded if necessary.
 * @param {maplibregl.Map} map
 */
window.PathChooser.showWaypoints = function (map) {
    function addLayers() {
        const features = [];
        for (const wp of store.waypoints.values()) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: wp.coords },
                properties: { id: wp.id, label: wp.label, tag: wp.tag },
            });
        }

        const sourceId = 'pathchooser-waypoints';

        // Remove existing layers/source if re-called
        if (map.getSource(sourceId)) {
            if (map.getLayer(sourceId + '-labels')) map.removeLayer(sourceId + '-labels');
            if (map.getLayer(sourceId + '-circles')) map.removeLayer(sourceId + '-circles');
            map.removeSource(sourceId);
        }

        map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
        });

        map.addLayer({
            id: sourceId + '-circles',
            type: 'circle',
            source: sourceId,
            paint: {
                'circle-radius': 6,
                'circle-color': '#e55e5e',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
            },
        });

        map.addLayer({
            id: sourceId + '-labels',
            type: 'symbol',
            source: sourceId,
            layout: {
                'text-field': ['get', 'label'],
                'text-size': 12,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
            },
            paint: {
                'text-color': '#333',
                'text-halo-color': '#fff',
                'text-halo-width': 1,
            },
        });

        console.log(`[PathChooser] showWaypoints: added ${features.length} waypoints to map`);
    }

    if (map.isStyleLoaded()) {
        addLayers();
    } else {
        map.on('load', addLayers);
    }
};

/**
 * Parse a coordinate string like "52.753252°N" or "13.471438°E" into a signed float.
 * South and West are returned as negative values.
 * @param {string|number} value
 * @returns {number|null}
 */
function parseCoordinate(value) {
    if (typeof value === 'number') return value;
    const match = String(value).trim().match(/^([\d.]+)[^A-Za-z\d]*([NSEWnsew])$/);
    if (!match) return null;
    let num = parseFloat(match[1]);
    const dir = match[2].toUpperCase();
    if (dir === 'S' || dir === 'W') num = -num;
    return num;
}