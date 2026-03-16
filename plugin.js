// Use a prefix so the layer selector can find our layers
const layerIdPrefix = 'path-chooser-';

// Create a global object called PathChooser if it doesn't exist
window.PathChooser = window.PathChooser || {};

class MapLibreDownloadControl {
    constructor(options = {}) {
    }

    onAdd(map) {
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        this.container.innerHTML = '<button class="maplibregl-ctrl-icon maplibregl-ctrl-download" title="Download GPX"></button>';
        const button = this.container.querySelector('button');
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 3v10m0 0l-4-4m4 4l4-4M4 17h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        this.container.addEventListener('click', () => {
            // Generate a simple GPX file as a string (replace with your actual GPX data)
            const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PathChooser">
  <trk>
    <name>Exported Track</name>
    <trkseg>
      <!-- Add track points here -->
    </trkseg>
  </trk>
</gpx>`;

            const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'route.gpx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
        return this.container;
    }
}

// Define the addToMapOnLoad function as a property of PathChooser
window.PathChooser.addToMapOnLoad = function(map, gpxUrl) {
    waypoints = [];
    let selectedWaypoints = [];
    const nodeList = document.getElementById('node_list');
    
    function updateNodeList() {
        nodeList.innerHTML = '';
        selectedWaypoints.forEach((waypoint, index) => {
            const div = document.createElement('div');
            div.style.padding = '5px';
            div.style.borderBottom = '1px solid #ccc';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            const label = document.createElement('span');
            label.textContent = `Waypoint ${waypoint.index} (${waypoint.coords[1].toFixed(4)}, ${waypoint.coords[0].toFixed(4)})`;
            
            const buttonContainer = document.createElement('div');
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => {
                selectedWaypoints.splice(index, 1);
                waypoint.element.style.background = 'white';
                updateNodeList();
            };
            
            const upBtn = document.createElement('button');
            upBtn.textContent = '↑';
            upBtn.disabled = index === 0;
            upBtn.onclick = () => {
                if (index > 0) {
                    [selectedWaypoints[index-1], selectedWaypoints[index]] = [selectedWaypoints[index], selectedWaypoints[index-1]];
                    updateNodeList();
                }
            };
            
            const downBtn = document.createElement('button');
            downBtn.textContent = '↓';
            downBtn.disabled = index === selectedWaypoints.length - 1;
            downBtn.onclick = () => {
                if (index < selectedWaypoints.length - 1) {
                    [selectedWaypoints[index], selectedWaypoints[index+1]] = [selectedWaypoints[index+1], selectedWaypoints[index]];
                    updateNodeList();
                }
            };
            
            buttonContainer.appendChild(upBtn);
            buttonContainer.appendChild(downBtn);
            buttonContainer.appendChild(deleteBtn);
            
            div.appendChild(label);
            div.appendChild(buttonContainer);
            nodeList.appendChild(div);
        });
    }
    
    map.on('load', async () => {
        const gpxSourceName = 'path-chooser-gpx-source';
        map.addSource(gpxSourceName, {
            'type': 'geojson',
            'data': gpxUrl,
        });

        map.addLayer({
            'id': layerIdPrefix + gpxSourceName,
            'type': 'line',
            'source': gpxSourceName,
            'minzoom': 0,
            'maxzoom': 20,
            'paint': {
            'line-color': 'red',
            'line-width': 5
            }
        });

        map.addControl(new MapLibreDownloadControl(), 'top-right')

        data = await map.getSource(gpxSourceName).getData();
        let waypointIndex = 1;
        for (feature of data.features) {
            if (feature.geometry.type == 'Point') {
                // Create a custom HTML element for the marker with a label
                const el = document.createElement('div');
                el.style.background = 'white';
                el.style.border = '2px solid blue';
                el.style.borderRadius = '50%';
                el.style.width = '28px';
                el.style.height = '28px';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.fontWeight = 'bold';
                el.style.fontSize = '16px';
                el.textContent = waypointIndex;

                const waypointData = {
                    index: waypointIndex,
                    coords: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
                    element: el
                };

                const m = new maplibregl.Marker({ element: el })
                    .setLngLat([feature.geometry.coordinates[0], feature.geometry.coordinates[1]])
                    .addTo(map);
                waypoints.push({...waypointData, marker: m});

                el.addEventListener('click', function() {
                    const existingIndex = selectedWaypoints.findIndex(w => w.index === waypointData.index);
                    
                    if (existingIndex >= 0) {
                        // Remove from selection
                        selectedWaypoints.splice(existingIndex, 1);
                        this.style.background = 'white';
                    } else {
                        // Add to selection
                        selectedWaypoints.push(waypointData);
                        this.style.background = 'lightgreen';
                    }
                    
                    updateNodeList();
                });

                waypointIndex++;
            }
        }
    });
};