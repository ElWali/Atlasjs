# Atlas.js

Atlas.js is an open-source, lightweight JavaScript library for creating mobile-friendly interactive maps. It's designed to be simple, fast, and easy to use.

## Features

*   **Lightweight:** Small file size for faster loading times.
*   **Interactive:** Supports panning, zooming, and markers.
*   **Tile Layers:** Easily add tile layers from various sources like OpenStreetMap.
*   **Customizable:** Control the map's appearance and behavior.
*   **Mobile-Friendly:** Responsive design for a great experience on all devices.

## Usage

Here's a simple example of how to create a map with Atlas.js:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Atlas.js Map</title>
  <link rel="stylesheet" href="atlasjs.css" />
  <style>
    html, body, #map {
      height: 100%;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script src="atlasjs-src-light.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Set the path for Atlas's images
      atlas.Icon.Default.imagePath = 'images/';

      // Define a tile layer
      const osmLayer = atlas.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });

      // Create map
      const map = atlas.map('map', {
        center: [51.505, -0.09],
        zoom: 13,
        layers: [osmLayer]
      });

      // Add a marker
      atlas.marker([51.5, -0.09]).addTo(map)
        .bindPopup('A pretty CSS3 popup.<br> Easily customizable.');
    });
  </script>
</body>
</html>
```

## Acknowledgements

This library is inspired by the architecture and design principles of Leaflet.js (https://leafletjs.com). We acknowledge and appreciate the work and contributions of the Leaflet.js community. Our library builds upon the concepts and patterns introduced by Leaflet.js while introducing new features and improvements.