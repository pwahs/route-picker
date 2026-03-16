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
PathChooser.styles['gute_beschaffenheit'] = {
    lineColor: 'red',
    lineWidth: 3,
};
PathChooser.styles['mittlere_beschaffenheit'] = {
    lineColor: 'red',
    lineWidth: 3,
    lineDasharray: [3, 3],  // 4px dash, 4px gap
};
PathChooser.styles['zu_nachbarn'] = {
    lineColor: 'grey',
    lineWidth: 3,
};

PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');
PathChooser.loadFromUrl('./data/gute_beschaffenheit.gpx', 'gute_beschaffenheit');
PathChooser.loadFromUrl('./data/mittlere_beschaffenheit.gpx', 'mittlere_beschaffenheit');
PathChooser.loadFromUrl('./data/zu_nachbarn.gpx', 'zu_nachbarn');
// PathChooser.addToMapOnLoad(map, 'gpx://./data/36055.gpx')