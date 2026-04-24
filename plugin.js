// ── PathChooser data layer ──────────────────────────────────────────
window.PathChooser = window.PathChooser || {};

// ── Configuration ──────────────────────────────────────────────────
/**
 * User-customizable configuration. Set before calling loadFromUrl().
 * @type {Object<string, any>}
 */
window.PathChooser.config = window.PathChooser.config || {
    matchThresholdMeters: 60,
    maxDistanceCacheSize: 10000,
};

/**
 * Localization strings. Override per-language as needed.
 * @type {Object<string, string>}
 */
window.PathChooser.i18n = window.PathChooser.i18n || {
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

// ── Internal state ──────────────────────────────────────────────────
const _internal = {
    map: null,
    styleLoadHandler: null,
    markers: [],
    pathLayerIds: [],
    tourWaypointIds: [],
    tourPathIds: [],
    tourLayerIds: [],
    previewMode: false,
    nextWaypointId: 1,
    nextPathId: 1,
    unofficialCounter: 1,
    distanceCacheOrder: [],
    addedEventListeners: [],
};

// ── Helpers ────────────────────────────────────────────────────────

const distanceCache = new Map();

/** Haversine distance between two [lng, lat] pairs, in metres. */
function distanceMeters(a, b) {
    const key = `${a[0]},${a[1]}|${b[0]},${b[1]}`;
    if (distanceCache.has(key)) return distanceCache.get(key);
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6_371_000; // earth radius in metres
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
        sinLat * sinLat +
        Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
    const result = 2 * R * Math.asin(Math.sqrt(h));
    _cacheDistance(key, result);
    return result;
}

/** Add entry to LRU-limited distance cache. */
function _cacheDistance(key, result) {
    const cfg = window.PathChooser.config;
    const maxSize = cfg.maxDistanceCacheSize || 10000;
    if (distanceCache.size >= maxSize) {
        const oldest = _internal.distanceCacheOrder.shift();
        if (oldest) distanceCache.delete(oldest);
    }
    distanceCache.set(key, result);
    _internal.distanceCacheOrder.push(key);
}

/** Store event listener reference for cleanup. */
function _addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    _internal.addedEventListeners.push({ element, event, handler });
}

/** Remove tracked listeners for elements no longer connected to the DOM. */
function _cleanupDetachedEventListeners() {
    _internal.addedEventListeners = _internal.addedEventListeners.filter(({ element, event, handler }) => {
        if (element && element.isConnected) return true;
        if (element) element.removeEventListener(event, handler);
        return false;
    });
}

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
        const id = 'w' + _internal.nextWaypointId++;
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
        return bestDist <= window.PathChooser.config.matchThresholdMeters ? best : null;
    }

    /**
     * Resolve a coordinate to an existing waypoint or create an "unofficial" one.
     * @param {number[]} coords [lng, lat]
     * @returns {Waypoint}
     */
    resolveWaypoint(coords) {
        const existing = this.findNearestWaypoint(coords);
        if (existing) return existing;
        console.log("New unofficial waypoint U", _internal.unofficialCounter, " created at " + coords[0] + "°N " + coords[1] + "°E");
        return this.addWaypoint('U' + _internal.unofficialCounter++, 'unofficial', coords);
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
        const id = 'p' + _internal.nextPathId++;
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

/**
 * Per-tag waypoint styles.  Users set entries on this object before loading.
 *
 * Each value may contain:
 *   background  – CSS background colour       (default: 'white')
 *   border      – CSS border shorthand         (default: '2px solid blue')
 *   color       – CSS text / label colour       (default: 'black')
 *   width       – marker width in px            (default: 28)
 *   height      – marker height in px           (default: 28)
 *   fontSize    – CSS font-size                 (default: '12px')
 *   shape       – 'circle' | 'square'           (default: 'circle')
 *
 * The special key '_default' is used for tags without a dedicated entry.
 *
 * @type {Object<string, Object>}
 */
const waypointStyleDefaults = {
    _default: {
        background: 'white',
        border: '2px solid blue',
        color: 'black',
        width: 28,
        height: 28,
        fontSize: '12px',
        shape: 'circle',
    },
};
const existingWaypointStyles = window.PathChooser.styles || {};
window.PathChooser.styles = {
    ...existingWaypointStyles,
    _default: {
        ...waypointStyleDefaults._default,
        ...(existingWaypointStyles._default || {}),
    },
};

/**
 * Global line style options for non-tag-specific overlays.
 *
 * Keys:
 *   _default   – fallback for all line groups
 *   basePath   – regular path layers rendered from loaded files
 *   tourSingle – selected tour path when a segment appears once
 *   tourRepeat – selected tour path when a segment appears multiple times
 *   candidate  – neighbor/candidate paths from the current endpoint
 *
 * @type {Object<string, Object>}
 */
const lineStyleDefaults = {
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
const existingLineStyles = window.PathChooser.lineStyles || {};
window.PathChooser.lineStyles = {
    ...existingLineStyles,
    _default: {
        ...lineStyleDefaults._default,
        ...(existingLineStyles._default || {}),
    },
    basePath: {
        ...lineStyleDefaults.basePath,
        ...(existingLineStyles.basePath || {}),
    },
    tourSingle: {
        ...lineStyleDefaults.tourSingle,
        ...(existingLineStyles.tourSingle || {}),
    },
    tourRepeat: {
        ...lineStyleDefaults.tourRepeat,
        ...(existingLineStyles.tourRepeat || {}),
    },
    candidate: {
        ...lineStyleDefaults.candidate,
        ...(existingLineStyles.candidate || {}),
    },
};

/**
 * Register a MapLibre map so that waypoints are shown automatically.
 * @param {maplibregl.Map} map
 */
window.PathChooser.setMap = function (map) {
    if (_internal.map && _internal.styleLoadHandler) {
        _internal.map.off('style.load', _internal.styleLoadHandler);
    }

    _internal.map = map;

    if (!_internal.styleLoadHandler) {
        _internal.styleLoadHandler = () => {
            _internal.pathLayerIds.length = 0;
            _internal.tourLayerIds.length = 0;
            _syncPaths();
        };
    }

    // After a full style reload, all custom layers/sources are gone — re-add them
    map.on('style.load', _internal.styleLoadHandler);
};

// Add a style cache
const styleCache = new Map();

/** Resolve the effective style for a given tag. */
function _styleFor(tag) {
    if (styleCache.has(tag)) return styleCache.get(tag);
    const styles = window.PathChooser.styles;
    const s = styles[tag] || {};
    const d = styles._default || {};
    const computedStyle = {...d, ...s};
    styleCache.set(tag, computedStyle);
    return computedStyle;
}

/** Resolve effective global line style for a named line group. */
function _lineStyleFor(group) {
    const lineStyles = window.PathChooser.lineStyles || {};
    const d = lineStyles._default || {};
    const s = lineStyles[group] || {};
    return { ...d, ...s };
}

/** Resolve localized UI text with optional token replacements. */
function _t(key, vars = null) {
    let text = window.PathChooser.i18n[key] || '';
    if (!vars) return text;
    for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
}

/** (Re-)create markers for every waypoint currently in the store. */
function _syncMarkers() {
    if (!_internal.map) return;
    _cleanupDetachedEventListeners();

    // Remove old markers
    for (const m of _internal.markers) m.remove();
    _internal.markers.length = 0;

    for (const wp of store.waypoints.values()) {
        const s = _styleFor(wp.tag);

        // Outer container passed to MapLibre (it controls opacity on this)
        const container = document.createElement('div');
        container.className = 'pathchooser-marker';
        container.dataset.waypointId = wp.id;

        // Inner element with our styling (we control opacity on this)
        const el = document.createElement('div');
        el.className = 'pathchooser-marker-inner';
        el.dataset.tag = wp.tag;
        el.style.background = s.background;
        el.style.border = s.border;
        el.style.borderRadius = s.shape === 'circle' ? '50%' : '0';
        el.style.width = s.width + 'px';
        el.style.height = s.height + 'px';
        el.style.color = s.color;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = s.fontSize;
        el.style.cursor = 'pointer';
        el.textContent = wp.label;
        el.title = `${wp.label} (${wp.tag})`;
        container.appendChild(el);

        _addEventListener(container, 'click', () => _onWaypointClick(wp.id));

        const marker = new maplibregl.Marker({ element: container })
            .setLngLat(wp.coords)
            .addTo(_internal.map);
        marker._waypointId = wp.id;
        marker._innerElement = el;
        _internal.markers.push(marker);
    }

    _updateTourVisuals();
}

/** (Re-)render all paths on the map as line layers. */
function _syncPaths() {
    if (!_internal.map) return;

    // Remove old path layers/sources
    for (const id of _internal.pathLayerIds) {
        if (_internal.map.getLayer(id)) _internal.map.removeLayer(id);
        if (_internal.map.getSource(id)) _internal.map.removeSource(id);
    }
    _internal.pathLayerIds.length = 0;

    for (const path of store.paths.values()) {
        const s = _styleFor(path.tag);
        const baseLineStyle = _lineStyleFor('basePath');
        const sourceId = 'pathchooser-path-' + path.id;

        _internal.map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: path.trackPoints },
            },
        });

        const paint = {
            'line-color': s.lineColor || baseLineStyle.color || s.background || 'red',
            'line-width': s.lineWidth ?? baseLineStyle.width ?? 3,
            'line-opacity': s.lineOpacity ?? s.opacity ?? baseLineStyle.opacity ?? 1,
        };
        const lineDasharray = s.lineDasharray || baseLineStyle.dasharray;
        if (lineDasharray) paint['line-dasharray'] = lineDasharray;

        if (!_internal.previewMode) {
            _internal.map.addLayer({
                id: sourceId,
                type: 'line',
                source: sourceId,
                paint,
            });
        }

        _internal.pathLayerIds.push(sourceId);
    }

    _updateTourVisuals();
}
// ── Loading (dummy) ────────────────────────────────────────────────

/**
 * Load waypoints and paths from a URL.
 *
 * Expected behaviour:
 * 1. Fetch the file at `url`.
 * 2. Parse waypoints → call store.addWaypoint(label, tag, coords) for each.
 * 3. Parse tracks  → for each track, resolve start/end via
 *    store.resolveWaypoint(coords), then call
 *    store.addPath(startId, endId, tag, trackPoints, url).
 *
 * @param {string} url  URL to a GPX, XLSX, or other file
 * @param {string} [tag]  Style tag for paths (used by GPX loader)
 * @returns {Promise<PathChooserStore>}
 */
window.PathChooser.loadFromUrl = async function (url, tag) {
    try {
        const ext = url.toLowerCase().split('.').pop();
        if (ext === 'xlsx') {
            await loadFromXlsx(url);
        } else if (ext === 'gpx') {
            await loadFromGpx(url, tag || 'default');
        }

        _syncMarkers();
        _syncPaths();

        // Fit map to show all waypoints
        if (_internal.map && store.waypoints.size > 0) {
            const allCoords = [...store.waypoints.values()].map(wp => wp.coords);
            const bounds = new maplibregl.LngLatBounds(allCoords[0], allCoords[0]);
            for (const c of allCoords) bounds.extend(c);
            _internal.map.fitBounds(bounds, { padding: 40 });
        }

        return store;
    } catch (error) {
        console.error(`[PathChooser] Failed to load from URL ${url}:`, error);
        throw error;
    }
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
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`[PathChooser] Failed to fetch ${url}: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

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
                continue;
            }

            // Rows below the header: label | lat | lngW
            for (let r = headerRow + 1; r < rows.length; r++) {
                const row = rows[r];
                const label = row[headerCol];
                const latStr = row[headerCol + 1];
                const lngStr = row[headerCol + 2];

                if (!label || !latStr || !lngStr) continue;

                const lat = parseCoordinate(latStr);
                const lng = parseCoordinate(lngStr);

                if (lat === null || lng === null) {
                    continue;
                }

                let labelStr = String(label).trim();
                if (/^\d$/.test(labelStr)) labelStr = '0' + labelStr;

                store.addWaypoint(labelStr, tag, [lng, lat]);
            }
        }
    } catch (error) {
        console.error(`[PathChooser] Failed to load XLSX ${url}:`, error);
        throw error;
    }
}

/**
 * Fetch a GPX file and create one path per <trk>.
 *
 * Each track's start/end points are resolved to existing waypoints
 * (or new "unofficial" ones are created).
 * The <name> element of each track (if present) is stored in path.source.
 *
 * @param {string} url
 * @param {string} tag  Style key for the loaded paths
 * @returns {Promise<void>}
 */
async function loadFromGpx(url, tag) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`[PathChooser] Failed to fetch ${url}: ${response.status}`);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');

        // Handle both namespaced (GPX 1.1) and non-namespaced (GPX 1.0) files
        const tracks = doc.getElementsByTagName('trk');

        for (const trk of tracks) {
            const nameEl = trk.getElementsByTagName('name')[0];
            const trackName = nameEl ? nameEl.textContent.trim() : url;

            const points = [];
            const trkpts = trk.getElementsByTagName('trkpt');
            for (const pt of trkpts) {
                const lat = parseFloat(pt.getAttribute('lat'));
                const lon = parseFloat(pt.getAttribute('lon'));
                if (!isNaN(lat) && !isNaN(lon)) {
                    points.push([lon, lat]);
                }
            }

            if (points.length < 2) {
                continue;
            }

            const startWp = store.resolveWaypoint(points[0]);
            const endWp = store.resolveWaypoint(points[points.length - 1]);
            store.addPath(startWp.id, endWp.id, tag, points, trackName);
        }
    } catch (error) {
        console.error(`[PathChooser] Failed to load GPX ${url}:`, error);
        throw error;
    }
}

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

// ── Tour selection ─────────────────────────────────────────────────

/** Handle a waypoint click. */
function _onWaypointClick(waypointId) {
    // If tour is empty, any waypoint is valid
    if (_internal.tourWaypointIds.length === 0) {
        _internal.tourWaypointIds.push(waypointId);
    } else {
        const lastId = _internal.tourWaypointIds[_internal.tourWaypointIds.length - 1];
        // Only allow clicking a neighbor of the last node
        const neighbors = store.getNeighbors(lastId);
        const edge = neighbors.find(n => n.neighbor.id === waypointId);
        if (!edge) return; // not a valid neighbor, ignore
        _internal.tourWaypointIds.push(waypointId);
        _internal.tourPathIds.push(edge.path.id);
    }
    _updateTourVisuals();
    _updateNodeList();
}

/** Remove the tour from the given index onward and update display. */
function _trimTourTo(index) {
    _internal.tourWaypointIds.length = index + 1;
    _internal.tourPathIds.length = index;
    _updateTourVisuals();
    _updateNodeList();
}

/** Update marker styles and map layers to reflect current tour state. */
function _updateTourVisuals() {
    if (!_internal.map) return;

    // Determine which waypoints are clickable
    const firstId = _internal.tourWaypointIds[0] || null;
    const lastId = _internal.tourWaypointIds[_internal.tourWaypointIds.length - 1] || null;
    const clickableIds = new Set();
    const candidatePathIds = new Set();

    if (!lastId) {
        // No selection yet — all waypoints are clickable
        for (const wp of store.waypoints.values()) clickableIds.add(wp.id);
    } else {
        // Only neighbors of the last waypoint
        for (const { neighbor, path } of store.getNeighbors(lastId)) {
            clickableIds.add(neighbor.id);
            candidatePathIds.add(path.id);
        }
    }

    const tourWpSet = new Set(_internal.tourWaypointIds);

    requestAnimationFrame(() => {
        // Update marker appearances
        for (const marker of _internal.markers) {
            const wpId = marker._waypointId;
            const el = marker._innerElement;
            const wp = store.waypoints.get(wpId);
            const s = _styleFor(wp.tag);

            if (wpId === lastId) {
                // Last selected node: yellow border, full opacity
                el.style.background = s.background;
                el.style.border = _internal.previewMode ? '4px solid #000000': '4px solid #FFD700';
                el.style.cursor = clickableIds.has(wpId) ? 'pointer' : 'default';
                el.style.opacity = '1';
                marker.getElement().style.zIndex = '3';
            } else if (_internal.previewMode) {
                if (wpId === firstId) {
                    el.style.background = s.background;
                    el.style.border = '4px solid #000000';
                    el.style.cursor = 'default';
                    el.style.opacity = '1';
                    marker.getElement().style.zIndex = '3';
                } else if (_internal.tourWaypointIds.includes(wpId)) {
                    el.style.background = s.background;
                    el.style.border = 'none';
                    el.style.cursor = 'default';
                    el.style.opacity = '1';
                    marker.getElement().style.zIndex = '2';
                } else {
                    el.style.opacity = '0';
                }
            } else if (clickableIds.has(wpId)) {
                // Clickable neighbor (may also be in tour): full opacity
                el.style.background = s.background;
                el.style.border = tourWpSet.has(wpId) ? '4px solid white' : s.border;
                el.style.cursor = 'pointer';
                el.style.opacity = '1';
                marker.getElement().style.zIndex = '2';
            } else {
                // Not clickable: dim (includes tour nodes that aren't last or neighbor)
                el.style.background = s.background;
                el.style.border = tourWpSet.has(wpId) ? '4px solid white' : s.border;
                el.style.cursor = 'default';
                el.style.opacity = '0.3';
                marker.getElement().style.zIndex = '0';
            }
        }
    });

    // Remove old tour/candidate layers
    for (const id of _internal.tourLayerIds) {
        if (_internal.map.getLayer(id)) _internal.map.removeLayer(id);
        if (_internal.map.getSource(id)) _internal.map.removeSource(id);
    }
    _internal.tourLayerIds.length = 0;

    // Draw selected tour path — concentric green/black layers for repeated paths
    const tourPathCounts = new Map();
    for (const pathId of _internal.tourPathIds) {
        tourPathCounts.set(pathId, (tourPathCounts.get(pathId) || 0) + 1);
    }
    const tourSingleStyle = _lineStyleFor('tourSingle');
    const tourRepeatStyle = _lineStyleFor('tourRepeat');
    let tourIdx = 0;
    for (const [pathId, count] of tourPathCounts) {
        const path = store.paths.get(pathId);
        const geojson = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: path.trackPoints },
        };

        if (count === 1) {
            // Single use: one green layer
            const srcId = 'pathchooser-tour-' + (tourIdx++) + '-' + pathId;
            _internal.map.addSource(srcId, { type: 'geojson', data: geojson });
            const paint = {
                'line-color': tourSingleStyle.color || '#00CC00',
                'line-width': tourSingleStyle.width ?? 6,
                'line-opacity': tourSingleStyle.opacity ?? 1,
            };
            if (tourSingleStyle.dasharray) paint['line-dasharray'] = tourSingleStyle.dasharray;
            _internal.map.addLayer({
                id: srcId, type: 'line', source: srcId,
                paint,
            });
            _internal.tourLayerIds.push(srcId);
        } else {
            // Multiple uses: concentric layers (green/black/green/...)
            // 5px green bands separated by 1px black lines
            let w = (tourRepeatStyle.baseWidthPerOccurrence ?? 6) * count - (tourRepeatStyle.overlapAdjustment ?? 1);
            for (let i = 0; i < count; i++) {
                const color = i % 2 === 0
                    ? (tourRepeatStyle.primaryColor || '#00CC00')
                    : (tourRepeatStyle.secondaryColor || '#000000');
                const srcId = 'pathchooser-tour-' + (tourIdx++) + '-' + pathId;
                _internal.map.addSource(srcId, { type: 'geojson', data: geojson });
                const paint = {
                    'line-color': color,
                    'line-width': Math.max(1, w),
                    'line-opacity': tourRepeatStyle.opacity ?? 1,
                };
                if (tourRepeatStyle.dasharray) paint['line-dasharray'] = tourRepeatStyle.dasharray;
                _internal.map.addLayer({
                    id: srcId, type: 'line', source: srcId,
                    paint,
                });
                _internal.tourLayerIds.push(srcId);
                w -= (i % 2 === 0)
                    ? (tourRepeatStyle.primaryShrink ?? 10)
                    : (tourRepeatStyle.secondaryShrink ?? 2);
            }
        }
    }

    if (!_internal.previewMode) {
        // Draw candidate paths (reachable from last node) on top
        const candidateStyle = _lineStyleFor('candidate');
        let candidateIdx = 0;
        for (const pathId of candidatePathIds) {
            const path = store.paths.get(pathId);
            const srcId = 'pathchooser-candidate-' + (candidateIdx++) + '-' + pathId;
            _internal.map.addSource(srcId, {
                type: 'geojson',
                data: { type: 'Feature', geometry: { type: 'LineString', coordinates: path.trackPoints } },
            });
            _internal.map.addLayer({
                id: srcId,
                type: 'line',
                source: srcId,
                paint: {
                    'line-color': candidateStyle.color || '#FF0000',
                    'line-width': candidateStyle.width ?? 2,
                    'line-opacity': candidateStyle.opacity ?? 1,
                    ...(candidateStyle.dasharray ? { 'line-dasharray': candidateStyle.dasharray } : {}),
                },
            });
            _internal.tourLayerIds.push(srcId);
        }
    }

    _updateOverlay();
}

/** Create a small styled badge element for a waypoint, matching its map marker style. */
function _createWaypointBadge(wp) {
    const s = _styleFor(wp.tag);
    const badge = document.createElement('span');
    badge.className = 'pathchooser-waypoint-badge';
    badge.dataset.tag = wp.tag;
    badge.dataset.waypointId = wp.id;
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.background = s.background;
    badge.style.border = s.border;
    badge.style.borderRadius = s.shape === 'circle' ? '50%' : '0';
    badge.style.width = s.width + 'px';
    badge.style.height = s.height + 'px';
    badge.style.color = s.color;
    badge.style.fontWeight = 'bold';
    badge.style.fontSize = s.fontSize;
    badge.style.flexShrink = '0';
    badge.textContent = wp.label;
    badge.title = `${wp.label} (${wp.tag})`;
    return badge;
}

let overlayTimeout;

/** Update the map overlay showing distance, last waypoint, and neighbors. */
function _updateOverlay() {
    clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
        if (!_internal.map) return;
        _cleanupDetachedEventListeners();
        const container = _internal.map.getContainer();

        let overlay = container.querySelector('#pathchooser-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pathchooser-overlay';
            overlay.className = 'pathchooser-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '10px';
            overlay.style.left = '10px';
            overlay.style.zIndex = '10';
            overlay.style.background = 'rgba(255,255,255,0.92)';
            overlay.style.borderRadius = '6px';
            overlay.style.padding = '8px 12px';
            overlay.style.fontSize = '13px';
            overlay.style.lineHeight = '1.6';
            overlay.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
            overlay.style.pointerEvents = 'none';
            overlay.style.maxWidth = '260px';
            container.appendChild(overlay);
        }

        overlay.innerHTML = '';
        // Enable pointer events only on interactive children
        overlay.style.pointerEvents = 'none';

        // Total distance
        let totalDist = 0;
        for (const pathId of _internal.tourPathIds) {
            totalDist += _pathLength(store.paths.get(pathId).trackPoints);
        }
        const distLine = document.createElement('div');
        distLine.className = 'pathchooser-overlay-distance';
        distLine.style.fontWeight = 'bold';
        distLine.textContent = `${_t('totalDistance')} ${_formatDist(totalDist)}`;
        overlay.appendChild(distLine);

        // Last waypoint
        const lastId = _internal.tourWaypointIds[_internal.tourWaypointIds.length - 1] || null;
        if (lastId) {
            const lastWp = store.waypoints.get(lastId);
            const row = document.createElement('div');
            row.className = 'pathchooser-overlay-current';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.marginTop = '4px';
            const lbl = document.createElement('span');
            lbl.className = 'pathchooser-overlay-current-label';
            lbl.textContent = _t('currentWaypoint');
            const badge = _createWaypointBadge(lastWp);
            badge.classList.add('pathchooser-overlay-current-badge');
            badge.style.border = '4px solid #FFD700';
            row.appendChild(lbl);
            row.appendChild(badge);

            // "zurück" button — removes the last waypoint
            if (_internal.tourWaypointIds.length > 1) {
                const backBtn = document.createElement('button');
                backBtn.className = 'pathchooser-overlay-action pathchooser-overlay-back';
                backBtn.textContent = _t('back');
                backBtn.style.pointerEvents = 'auto';
                backBtn.style.cursor = 'pointer';
                backBtn.style.fontSize = '12px';
                backBtn.onclick = () => {
                    _trimTourTo(_internal.tourWaypointIds.length - 2);
                    _fitToLastWaypoints();
                };
                row.appendChild(backBtn);
            } else {
                // Single node — offer to clear the tour
                const resetBtn = document.createElement('button');
                resetBtn.className = 'pathchooser-overlay-action pathchooser-overlay-reset';
                resetBtn.textContent = _t('reset');
                resetBtn.style.pointerEvents = 'auto';
                resetBtn.style.cursor = 'pointer';
                resetBtn.style.fontSize = '12px';
                resetBtn.onclick = () => {
                    _internal.tourWaypointIds.length = 0;
                    _internal.tourPathIds.length = 0;
                    _updateTourVisuals();
                    _updateNodeList();
                };
                row.appendChild(resetBtn);
            }

            overlay.appendChild(row);

            // Neighbor waypoints
            const neighbors = store.getNeighbors(lastId);
            if (neighbors.length > 0) {
                const nRow = document.createElement('div');
                nRow.className = 'pathchooser-overlay-neighbors';
                nRow.style.marginTop = '4px';
                const nLbl = document.createElement('div');
                nLbl.className = 'pathchooser-overlay-neighbors-label';
                nLbl.textContent = _t('nextWaypoints');
                nRow.appendChild(nLbl);
                const badges = document.createElement('div');
                badges.className = 'pathchooser-overlay-neighbors-badges';
                badges.style.display = 'flex';
                badges.style.flexWrap = 'wrap';
                badges.style.gap = '4px';
                badges.style.marginTop = '2px';
                for (const { neighbor } of neighbors) {
                    const nb = _createWaypointBadge(neighbor);
                    nb.classList.add('pathchooser-overlay-neighbor-badge');
                    nb.style.cursor = 'pointer';
                    nb.style.pointerEvents = 'auto';
                    _addEventListener(nb, 'click', () => {
                        _onWaypointClick(neighbor.id);
                        _fitToLastWaypoints();
                    });
                    badges.appendChild(nb);
                }
                nRow.appendChild(badges);
                overlay.appendChild(nRow);
            }
        } else {
            const hint = document.createElement('div');
            hint.className = 'pathchooser-overlay-hint';
            hint.style.color = '#666';
            hint.textContent = _t('startHint');
            overlay.appendChild(hint);
        }
    }, 50);
}

/** Fit the map so the last N tour waypoints (default 4) are all visible. */
function _fitToLastWaypoints(n) {
    if (!_internal.map || _internal.tourWaypointIds.length === 0) return;
    n = n || 4;
    const ids = _internal.tourWaypointIds.slice(-n);
    const coords = ids.map(id => store.waypoints.get(id).coords);
    const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
    for (const c of coords) bounds.extend(c);
    // Only move/zoom if any point is outside the current view
    const mapBounds = _internal.map.getBounds();
    const allVisible = coords.every(c => mapBounds.contains(c));
    if (!allVisible) {
        _internal.map.fitBounds(bounds, { padding: 80, maxZoom: _internal.map.getZoom() });
    }
}

/** Update the #node_list div with the current tour waypoints. */
function _updateNodeList() {
    const nodeList = document.getElementById('node_list');
    if (!nodeList) return;
    nodeList.classList.add('pathchooser-node-list');
    nodeList.innerHTML = '';

    _internal.tourWaypointIds.forEach((wpId, index) => {
        const wp = store.waypoints.get(wpId);

        const div = document.createElement('div');
        div.className = 'pathchooser-node-item';
        div.style.padding = '5px';
        div.style.borderBottom = '1px solid #ccc';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';

        const label = document.createElement('span');
        label.className = 'pathchooser-node-label';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '6px';

        const numSpan = document.createElement('span');
        numSpan.className = 'pathchooser-node-index';
        numSpan.textContent = `${index + 1}.`;
        label.appendChild(numSpan);

        const badge = _createWaypointBadge(wp);
        badge.classList.add('pathchooser-node-badge');
        badge.style.cursor = 'pointer';
        _addEventListener(badge, 'click', () => {
            if (!_internal.map) return;
            _internal.map.flyTo({ center: wp.coords, speed: 1.2 });
            // Bring the corresponding map marker to front and full opacity
            for (const m of _internal.markers) {
                if (m._waypointId === wpId) {
                    m._innerElement.style.opacity = '1';
                    m.getElement().style.zIndex = '10';
                } else if (m.getElement().style.zIndex === '10') {
                    // Reset any previously highlighted marker
                    m.getElement().style.zIndex = '';
                }
            }
        });
        label.appendChild(badge);

        const tagSpan = document.createElement('span');
        tagSpan.className = 'pathchooser-node-tag';
        tagSpan.textContent = `(${wp.tag})`;
        tagSpan.style.fontStyle = 'italic';
        tagSpan.style.color = '#666';
        label.appendChild(tagSpan);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'pathchooser-node-actions';

        // "Remove from here" button: trims tour back to this node
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'pathchooser-node-delete';
        deleteBtn.textContent = index === 0 ? _t('deleteAll') : _t('deleteFrom');
        deleteBtn.onclick = () => {
            if (index === 0) {
                _internal.tourWaypointIds.length = 0;
                _internal.tourPathIds.length = 0;
            } else {
                _trimTourTo(index - 1);
                return;
            }
            _updateTourVisuals();
            _updateNodeList();
        };

        buttonContainer.appendChild(deleteBtn);
        div.appendChild(label);
        div.appendChild(buttonContainer);
        nodeList.appendChild(div);
    });

    // "Reverse" button: reverse the entire tour order
    if (_internal.tourWaypointIds.length >= 2) {
        const reverseBtn = document.createElement('button');
        reverseBtn.className = 'pathchooser-node-reverse';
        reverseBtn.textContent = _t('reverse');
        reverseBtn.style.margin = '8px 5px';
        reverseBtn.onclick = () => {
            _internal.tourWaypointIds.reverse();
            _internal.tourPathIds.reverse();
            _updateTourVisuals();
            _updateNodeList();
        };
        nodeList.appendChild(reverseBtn);
    }

    // Distance summary
    if (_internal.tourPathIds.length > 0) {
        const distByTag = new Map();
        let totalDist = 0;
        for (const pathId of _internal.tourPathIds) {
            const path = store.paths.get(pathId);
            const d = _pathLength(path.trackPoints);
            totalDist += d;
            distByTag.set(path.tag, (distByTag.get(path.tag) || 0) + d);
        }

        const summary = document.createElement('div');
        summary.className = 'pathchooser-node-summary';
        summary.style.padding = '8px 5px';
        summary.style.fontWeight = 'bold';
        summary.textContent = `${_t('totalDistance')} ${_formatDist(totalDist)}`;

        if (distByTag.size > 1) {
            for (const [tag, dist] of distByTag) {
                const line = document.createElement('div');
                line.className = 'pathchooser-node-summary-line';
                line.style.padding = '2px 5px';
                line.style.fontWeight = 'normal';
                line.style.fontStyle = 'italic';
                line.textContent = `  ${tag}: ${_formatDist(dist)}`;
                summary.appendChild(line);
            }
        }

        nodeList.appendChild(summary);
    }

    // Routenvorschau checkbox
    if (_internal.tourWaypointIds.length >= 2) {
        const previewRow = document.createElement('div');
        previewRow.className = 'pathchooser-node-preview';
        previewRow.style.display = 'flex';
        previewRow.style.alignItems = 'center';
        previewRow.style.gap = '8px';
        previewRow.style.margin = '8px 5px';
        const previewLabel = document.createElement('label');
        previewLabel.className = 'pathchooser-node-preview-label';
        previewLabel.textContent = _t('preview');
        const previewCheckbox = document.createElement('input');
        previewCheckbox.className = 'pathchooser-node-preview-checkbox';
        previewCheckbox.type = 'checkbox';
        previewCheckbox.checked = _internal.previewMode || false;
        previewCheckbox.style.pointerEvents = 'auto';
        previewCheckbox.style.cursor = 'pointer';
        previewCheckbox.onchange = () => {
            _internal.previewMode = previewCheckbox.checked;
            _syncPaths();
            _updateTourVisuals();
        };
        previewRow.appendChild(previewCheckbox);
        previewRow.appendChild(previewLabel);
        nodeList.appendChild(previewRow);

        // Download GPX button
        const dlBtn = document.createElement('button');
        dlBtn.className = 'pathchooser-node-download';
        dlBtn.textContent = _t('download');
        dlBtn.style.margin = '8px 5px';
        dlBtn.onclick = () => _downloadGpx();
        nodeList.appendChild(dlBtn);
    } else {
        // Make sure we are not in preview mode anymore.
        if (_internal.previewMode) {
            _internal.previewMode = false;
            _syncPaths();
            _updateTourVisuals();
        }
    }
}

/** Compute the total length of a polyline (array of [lng, lat]) in metres. */
function _pathLength(trackPoints) {
    let total = 0;
    for (let i = 1; i < trackPoints.length; i++) {
        total += distanceMeters(trackPoints[i - 1], trackPoints[i]);
    }
    return total;
}

/** Format a distance in metres as a human-readable string. */
function _formatDist(meters) {
    return meters >= 1000
        ? (meters / 1000).toFixed(2) + ' km'
        : Math.round(meters) + ' m';
}

/** Build a GPX XML string from the current tour and trigger a download. */
function _downloadGpx() {
    if (_internal.tourWaypointIds.length < 2) return;

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Collect correctly oriented track points
    const allPoints = [];
    for (let i = 0; i < _internal.tourPathIds.length; i++) {
        const fromWpId = _internal.tourWaypointIds[i];
        const path = store.paths.get(_internal.tourPathIds[i]);
        let pts = path.trackPoints;
        if (path.startWaypointId !== fromWpId) {
            pts = [...pts].reverse();
        }
        // Avoid duplicating the junction point between consecutive segments
        if (i > 0 && allPoints.length > 0) {
            const last = allPoints[allPoints.length - 1];
            if (pts[0][0] === last[0] && pts[0][1] === last[1]) {
                pts = pts.slice(1);
            }
        }
        allPoints.push(...pts);
    }

    const firstWp = store.waypoints.get(_internal.tourWaypointIds[0]);
    const lastWp = store.waypoints.get(_internal.tourWaypointIds[_internal.tourWaypointIds.length - 1]);
    const trackName = _t('routeFrom', { from: firstWp.label, to: lastWp.label });

    // Compute total distance
    let totalDist = 0;
    for (const pathId of _internal.tourPathIds) {
        totalDist += _pathLength(store.paths.get(pathId).trackPoints);
    }

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    gpx += `<gpx version="1.1" creator="PathChooser"\n`;
    gpx += `     xmlns="http://www.topografix.com/GPX/1/1">\n`;
    gpx += `  <metadata>\n`;
    gpx += `    <name>${esc(trackName)}</name>\n`;
    gpx += `    <desc>${esc(_t('waypointsDistance', { count: _internal.tourWaypointIds.length, distance: _formatDist(totalDist) }))}</desc>\n`;
    gpx += `    <time>${new Date().toISOString()}</time>\n`;
    gpx += `  </metadata>\n`;

    // Labeled waypoints for each tour stop
    _internal.tourWaypointIds.forEach((wpId, i) => {
        const wp = store.waypoints.get(wpId);
        gpx += `  <wpt lat="${wp.coords[1]}" lon="${wp.coords[0]}">\n`;
        gpx += `    <name>${esc(wp.label)}</name>\n`;
        gpx += `    <desc>${esc(wp.tag)}</desc>\n`;
        gpx += `    <type>${esc(wp.tag)}</type>\n`;
        gpx += `    <cmt>Stop ${i + 1} von ${_internal.tourWaypointIds.length}</cmt>\n`;
        gpx += `  </wpt>\n`;
    });

    // Single continuous track
    gpx += `  <trk>\n`;
    gpx += `    <name>${esc(trackName)}</name>\n`;
    gpx += `    <desc>${esc(_formatDist(totalDist))}</desc>\n`;
    gpx += `    <trkseg>\n`;
    for (const [lng, lat] of allPoints) {
        gpx += `      <trkpt lat="${lat}" lon="${lng}"></trkpt>\n`;
    }
    gpx += `    </trkseg>\n`;
    gpx += `  </trk>\n`;
    gpx += `</gpx>\n`;

    // Trigger download
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.className = 'pathchooser-download-link';
    a.href = url;
    a.download = trackName.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F ]/g, '') + '.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}