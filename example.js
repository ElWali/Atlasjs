// Example usage
document.addEventListener('DOMContentLoaded', () => {
  const map = miniatlas('map', {
    center: [51.505, -0.09],
    zoom: 13,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // Add a marker
  const marker = map.addMarker([51.5, -0.09], { title: 'London' });
  marker.bindPopup('<strong>London</strong><br>The capital of England');

  // Add another marker with popup open by default
  const marker2 = map.addMarker([51.51, -0.1], { title: 'Another point' });
  marker2.bindPopup('Another interesting location').openPopup();

  // Add a third marker
  const marker3 = map.addMarker([51.49, -0.08], { title: 'South London' });
  marker3.bindPopup('<strong>South London</strong><br>A vibrant area');

  // Create bounds and fit to view
  const bounds = new MiniAtlas.Bounds(
    [51.49, -0.11], // Southwest
    [51.52, -0.07]  // Northeast
  );

  // Add fitBounds button
  const fitBoundsBtn = document.createElement('button');
  fitBoundsBtn.textContent = 'Fit Bounds';
  fitBoundsBtn.style.position = 'absolute';
  fitBoundsBtn.style.top = '12px';
  fitBoundsBtn.style.left = '12px';
  fitBoundsBtn.style.zIndex = '600';
  fitBoundsBtn.style.padding = '8px 12px';
  fitBoundsBtn.style.background = '#fff';
  fitBoundsBtn.style.border = '1px solid #ccc';
  fitBoundsBtn.style.borderRadius = '4px';
  fitBoundsBtn.style.cursor = 'pointer';
  fitBoundsBtn.style.fontFamily = 'inherit';
  document.body.appendChild(fitBoundsBtn);

  fitBoundsBtn.addEventListener('click', () => {
    map.fitBounds(bounds);
  });

  // Event listeners
  map.container.addEventListener('click', (e) => {
    if (e.target === map.container) {
      console.log('Map clicked at:', map.containerPointToLatLng({x: e.clientX, y: e.clientY}));
    }
  });

  // Add keyboard instructions
  const instructions = document.createElement('div');
  instructions.innerHTML = `
    <div style="position: absolute; bottom: 60px; left: 12px; background: rgba(255,255,255,0.8); padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 600;">
      <strong>Controls:</strong> Arrow keys to pan, +/- to zoom, Esc to close popups
    </div>
  `;
  document.body.appendChild(instructions);

  // Add search control
  const searchControl = document.createElement('div');
  searchControl.className = 'm-search-control';
  searchControl.innerHTML = `
    <input type="text" placeholder="Search for places..." />
    <button>🔍</button>
  `;
  map.container.appendChild(searchControl);

  const searchInput = searchControl.querySelector('input');
  const searchButton = searchControl.querySelector('button');

  searchButton.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (query) {
      const result = await map.search(query);
      if (result) {
        map.setView(result, 15);
      } else {
        alert('Location not found');
      }
    }
  });

  searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        const result = await map.search(query);
        if (result) {
          map.setView(result, 15);
        } else {
          alert('Location not found');
        }
      }
    }
  });

  // Add drawing controls
  const drawControl = document.createElement('div');
  drawControl.className = 'm-draw-control';
  drawControl.innerHTML = `
    <button class="draw-marker" title="Add Marker">📍</button>
    <button class="draw-line" title="Draw Line">📏</button>
    <button class="draw-circle" title="Draw Circle">⭕</button>
    <button class="draw-rectangle" title="Draw Rectangle">⬜</button>
  `;
  map.container.appendChild(drawControl);

  // Drawing control event listeners
  const drawButtons = drawControl.querySelectorAll('button');
  drawButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      drawButtons.forEach(btn => btn.classList.remove('active'));

      // Add active class to clicked button
      button.classList.add('active');

      // Determine drawing mode
      const mode = button.className.replace('draw-', '');
      map.startDrawing(mode);
    });
  });

  // Add escape key to cancel drawing
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      drawButtons.forEach(btn => btn.classList.remove('active'));
      map.stopDrawing();
    }
  });

  // Layer Control
  const tileLayers = {
    'OpenStreetMap': {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    },
    'Satellite': {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
    }
  };

  const layerControl = document.createElement('div');
  layerControl.className = 'm-layer-control';
  layerControl.style.position = 'absolute';
  layerControl.style.top = '12px';
  layerControl.style.left = '50px';
  layerControl.style.zIndex = '600';
  layerControl.style.background = '#fff';
  layerControl.style.padding = '5px';
  layerControl.style.borderRadius = '4px';

  for (const name in tileLayers) {
    const layer = tileLayers[name];
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => {
      map.setTileLayer(layer.url, layer.options);
    });
    layerControl.appendChild(button);
  }

  map.container.appendChild(layerControl);
});