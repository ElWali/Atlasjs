document.addEventListener('DOMContentLoaded', () => {
  // Set the path for Atlas's images
  Atlas.Icon.Default.imagePath = 'images/';

  // Define tile layers
  const osmLayer = Atlas.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  const satelliteLayer = Atlas.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // Create map
  const map = Atlas.map('map', {
    center: [51.505, -0.09],
    zoom: 13,
    layers: [osmLayer] // Default layer
  });

  // Add layer control
  const baseLayers = {
    "OpenStreetMap": osmLayer,
    "Satellite": satelliteLayer
  };
  Atlas.control.layers(baseLayers).addTo(map);

  // Add markers
  Atlas.marker([51.5, -0.09]).addTo(map)
    .bindPopup('<strong>London</strong><br>The capital of England.');

  Atlas.marker([51.51, -0.1]).addTo(map)
    .bindPopup('Another interesting location.')
    .openPopup();

  Atlas.marker([51.49, -0.08]).addTo(map)
    .bindPopup('<strong>South London</strong><br>A vibrant area.');

  // Fit Bounds button
  const bounds = Atlas.latLngBounds([51.49, -0.11], [51.52, -0.07]);
  const fitBoundsBtn = document.createElement('button');
  fitBoundsBtn.textContent = 'Fit Bounds';
  fitBoundsBtn.style.position = 'absolute';
  fitBoundsBtn.style.top = '10px';
  fitBoundsBtn.style.left = '50px';
  fitBoundsBtn.style.zIndex = '1000';
  fitBoundsBtn.style.padding = '8px 12px';
  fitBoundsBtn.style.background = '#fff';
  fitBoundsBtn.style.border = '2px solid rgba(0,0,0,0.2)';
  fitBoundsBtn.style.borderRadius = '4px';
  fitBoundsBtn.style.cursor = 'pointer';
  document.body.appendChild(fitBoundsBtn);

  fitBoundsBtn.addEventListener('click', () => {
    map.fitBounds(bounds);
  });
});
