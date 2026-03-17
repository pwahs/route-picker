//maplibregl.addProtocol('gpx', VectorTextProtocol.VectorTextProtocol);

var map = new maplibregl.Map({
container: 'map',
style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap streets
center: [13.137, 53.011], // starting position [lng, lat]
zoom: 10 // starting zoom
});

VectorTextProtocol.addProtocols(maplibregl);
PathChooser.setMap(map);

// ── Waypoint styles per tag ───────────────────────────────────────
PathChooser.styles['Barnimer Land'] = {
    background: 'red',
    border: 'none',
    color: 'white',
};
PathChooser.styles['Nachbarregionen'] = {
    background: 'grey',
    border: 'none',
    color: 'white',
};

// ── Path styles per tag ───────────────────────────────────────────
PathChooser.styles['Gute Beschaffenheit'] = {
    lineColor: 'red',
    lineWidth: 3,
};
PathChooser.styles['Mittlere Beschaffenheit'] = {
    lineColor: 'red',
    lineWidth: 3,
    lineDasharray: [3, 3],  // 4px dash, 4px gap
};
PathChooser.styles['Zu Nachbarn'] = {
    lineColor: 'grey',
    lineWidth: 3,
};

PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');
PathChooser.loadFromUrl('./data/gute_beschaffenheit.gpx', 'Gute Beschaffenheit');
PathChooser.loadFromUrl('./data/mittlere_beschaffenheit.gpx', 'Mittlere Beschaffenheit');
PathChooser.loadFromUrl('./data/zu_nachbarn.gpx', 'Zu Nachbarn');
// PathChooser.addToMapOnLoad(map, 'gpx://./data/36055.gpx')