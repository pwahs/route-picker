// ── PathChooser data layer ──────────────────────────────────────────
window.PathChooser = window.PathChooser || {};

// ── Configuration ──────────────────────────────────────────────────
const MATCH_THRESHOLD_METERS = 50;

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
 * @property {number[][}} trackPoints   – array of [lng, lat] forming the full track
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
     * @param {number[][]} trackPoints  array of [lng, lat]
     * @param {string} source  origin filename / URL
     * @returns {Path}
     */
    addPath(startWaypointId, endWaypointId, trackPoints, source) {
        const id = 'p' + _nextPathId++;
        const path = { id, startWaypointId, endWaypointId, trackPoints, source };
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
 *    store.addPath(startId, endId, trackPoints, url).
 *
 * @param {string} url  URL to a GPX (or other) file
 * @returns {Promise<PathChooserStore>}
 */
window.PathChooser.loadFromUrl = async function (url) {
    console.log(`[PathChooser] loadFromUrl called with: ${url}`);
    // TODO: fetch + parse + populate store
    return store;
};