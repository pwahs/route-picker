async function initializeMap() {

    var map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap streets
    center: [13.137, 53.011], // starting position [lng, lat]
    zoom: 10 // starting zoom
    });

    VectorTextProtocol.addProtocols(maplibregl);
    PathChooser.setMap(map);

    // ── Waypoint styles per tag ───────────────────────────────────────
    await PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');
    PathChooser.styles['Knotenpunkt'] = {
        background: 'red',
        border: 'none',
        color: 'white',
    };
    PathChooser.styles['Nachbarregionen'] = {
        background: 'grey',
        border: 'none',
        color: 'white',
    };
    PathChooser.styles['Knotenpunkt in Planung'] = {
        background: 'white',
        border: '1px solid red',
        color: 'red',
    };

    // ── Path styles per tag ───────────────────────────────────────────
    await PathChooser.loadFromUrl('./data/gute_beschaffenheit.gpx', '≥ 90% leicht befahrbar');
    PathChooser.styles['≥ 90% leicht befahrbar'] = {
        lineColor: 'red',
        lineWidth: 3,
    };
    await PathChooser.loadFromUrl('./data/mittlere_beschaffenheit.gpx', '>10 % technisch anspruchsvoll');
    PathChooser.styles['>10 % technisch anspruchsvoll'] = {
        lineColor: 'red',
        lineWidth: 3,
        lineDasharray: [3, 3],  // 4px dash, 4px gap
    };
    await PathChooser.loadFromUrl('./data/zu_nachbarn.gpx', 'unbekannte Beschaffenheit');
    PathChooser.styles['unbekannte Beschaffenheit'] = {
        lineColor: 'grey',
        lineWidth: 3,
    };
}

initializeMap();