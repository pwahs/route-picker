async function initializeMap() {

    var map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty', // OpenFreeMap streets
    center: [13.137, 53.011], // starting position [lng, lat]
    zoom: 10 // starting zoom
    });
    map.addControl(new maplibregl.NavigationControl());
    VectorTextProtocol.addProtocols(maplibregl);
    PathChooser.setMap(map);

    // ── Waypoint styles per tag ───────────────────────────────────────
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

    // ── Global line styles (tour + candidate overlays) ────────────────
    PathChooser.lineStyles._default = {
        width: 3,
        opacity: 0.3,
    };
    PathChooser.lineStyles.tourSingle = {
        color: '#00CC00',
        width: 6,
        opacity: 1,
    };
    PathChooser.lineStyles.tourRepeat = {
        primaryColor: '#00CC00',
        secondaryColor: '#000000',
        baseWidthPerOccurrence: 6,
        overlapAdjustment: 1,
        primaryShrink: 10,
        secondaryShrink: 2,
        opacity: 1,
    };
    PathChooser.lineStyles.candidate = {
        color: '#CCCC00',
        width: 2,
        opacity: 1,
    };
    await PathChooser.loadFromUrl('./data/GPS-Daten_Knotenpunkte.xlsx');

    // ── Path styles per tag ───────────────────────────────────────────
    PathChooser.styles['≥ 90 % leicht befahrbar'] = {
        lineColor: 'red',
        lineWidth: 3,
        opacity: 0.5,
    };
    await PathChooser.loadFromUrl('./data/gute_beschaffenheit.gpx', '≥ 90 % leicht befahrbar');
   
    PathChooser.styles['>10 % technisch anspruchsvoll'] = {
        lineColor: 'red',
        lineWidth: 3,
        lineDasharray: [3, 3],  // 3px dash, 3px gap
    };
    await PathChooser.loadFromUrl('./data/mittlere_beschaffenheit.gpx', '>10 % technisch anspruchsvoll');
    
    PathChooser.styles['unbekannte Beschaffenheit'] = {
        lineColor: 'grey',
        lineWidth: 3,
    };
    await PathChooser.loadFromUrl('./data/zu_nachbarn.gpx', 'unbekannte Beschaffenheit');
}

initializeMap();