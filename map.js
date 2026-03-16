//maplibregl.addProtocol('gpx', VectorTextProtocol.VectorTextProtocol);

var map = new maplibregl.Map({
container: 'map',
style: 'https://demotiles.maplibre.org/style.json', // stylesheet location
center: [13.137, 53.011], // starting position [lng, lat]
zoom: 10 // starting zoom
});

VectorTextProtocol.addProtocols(maplibregl);
PathChooser.addToMapOnLoad(map, 'gpx://./data/36055.gpx')