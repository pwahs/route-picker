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

    // ── Waypoint styles per tag, tag comes from the xlsx sheet names ────────────
    PathChooser.styles['Knotenpunkt'] = {
        background: '#FF0000',
        border: 'none',
        color: 'white',
    };
    PathChooser.styles['Nachbarregionen'] = {
        background: 'grey',
        border: 'none',
        width: '20',
        height: '20',
        fontSize: '10',
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
        color: '#FF0000',
        width: 2,
        opacity: 1,
    };
    await PathChooser.loadFromUrl('./data/knotenpunkte.xlsx');

    // ── Path styles per tag ───────────────────────────────────────────
    PathChooser.styles['≥ 90 % leicht befahrbar'] = {
        lineColor: 'red',
        lineWidth: 3,
        opacity: 0.5,
    };
    await PathChooser.loadFromUrl('./data/00_GPX_gutbeschaffen.gpx', '≥ 90 % leicht befahrbar');
   
    PathChooser.styles['>10 % technisch anspruchsvoll'] = {
        lineColor: 'red',
        lineWidth: 3,
        lineDasharray: [3, 3],  // 3px dash, 3px gap
    };
    await PathChooser.loadFromUrl('./data/00_GPX_schlechtbeschaffen.gpx', '>10 % technisch anspruchsvoll');
    
    PathChooser.styles['unbekannte Beschaffenheit'] = {
        lineColor: 'grey',
        lineWidth: 3,
    };
    await PathChooser.loadFromUrl('./data/00_GPX_Nachbar_merged.gpx', 'unbekannte Beschaffenheit');
}

initializeMap();