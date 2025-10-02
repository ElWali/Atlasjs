/**
 * MiniAtlas v1.0.0
 * A lightweight, professional web mapping library
 * Inspired by Leaflet with modern JavaScript practices
 *
 * Features:
 * - Web Mercator tile rendering with efficient caching
 * - Smooth pan/zoom with mouse wheel and touch gestures
 * - Pinch-to-zoom on touch devices
 * - Interactive markers with customizable popups
 * - Zoom controls, scale bar, and attribution
 * - Keyboard navigation support
 * - Responsive design with resize handling
 * - World wrapping for seamless panning
 * - Search control with Nominatim API
 * - Drawing tools (markers, lines, circles, rectangles)
 * - Layer management system
 *
 * @license MIT
 */

(function(global) {
  'use strict';

  // ========================================
  // UTILITIES & HELPERS
  // ========================================

  const Util = {
    TILE_SIZE: 256,
    EARTH_RADIUS: 6378137, // meters
    MAX_LATITUDE: 85.0511287798,

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    /**
     * Convert latitude to Web Mercator Y (0-1 range)
     */
    latToY(lat) {
      lat = this.clamp(lat, -this.MAX_LATITUDE, this.MAX_LATITUDE);
      const sin = Math.sin(lat * Math.PI / 180);
      const y = 0.5 - (Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI));
      return y;
    },

    /**
     * Convert longitude to Web Mercator X (0-1 range)
     */
    lngToX(lng) {
      return (lng + 180) / 360;
    },

    /**
     * Convert Web Mercator X to longitude
     */
    xToLng(x) {
      return x * 360 - 180;
    },

    /**
     * Convert Web Mercator Y to latitude
     */
    yToLat(y) {
      const n = Math.PI - 2 * Math.PI * y;
      return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    },

    /**
     * Get distance in pixels between two points
     */
    distance(p1, p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Get center point between two points
     */
    midpoint(p1, p2) {
      return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
    },

    /**
     * Debounce function calls
     */
    debounce(fn, delay) {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    /**
     * Create DOM element with optional className and parent
     */
    createEl(tag, className, parent) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (parent) parent.appendChild(el);
      return el;
    }
  };

  // ========================================
  // POINT CLASS
  // ========================================

  class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    clone() {
      return new Point(this.x, this.y);
    }

    add(other) {
      return new Point(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
      return new Point(this.x - other.x, this.y - other.y);
    }

    multiplyBy(factor) {
      return new Point(this.x * factor, this.y * factor);
    }
  }

  // ========================================
  // LATLNG CLASS
  // ========================================

  class LatLng {
    constructor(lat, lng) {
      this.lat = Util.clamp(lat, -Util.MAX_LATITUDE, Util.MAX_LATITUDE);
      this.lng = lng;
    }

    toArray() {
      return [this.lat, this.lng];
    }

    static from(input) {
      if (input instanceof LatLng) return input;
      if (Array.isArray(input)) return new LatLng(input[0], input[1]);
      if (input.lat !== undefined && input.lng !== undefined) {
        return new LatLng(input.lat, input.lng);
      }
      throw new Error('Invalid LatLng input');
    }
  }

  // ========================================
  // BOUNDS CLASS
  // ========================================

  class Bounds {
    constructor(southWest, northEast) {
      this.southWest = LatLng.from(southWest);
      this.northEast = LatLng.from(northEast);
    }

    getSouthWest() {
      return this.southWest;
    }

    getNorthEast() {
      return this.northEast;
    }

    contains(latlng) {
      const ll = LatLng.from(latlng);
      return ll.lat <= this.northEast.lat && ll.lat >= this.southWest.lat &&
             ll.lng >= this.southWest.lng && ll.lng <= this.northEast.lng;
    }

    extend(latlng) {
      const ll = LatLng.from(latlng);
      this.southWest.lat = Math.min(this.southWest.lat, ll.lat);
      this.southWest.lng = Math.min(this.southWest.lng, ll.lng);
      this.northEast.lat = Math.max(this.northEast.lat, ll.lat);
      this.northEast.lng = Math.max(this.northEast.lng, ll.lng);
      return this;
    }
  }

  // ========================================
  // MAP CLASS
  // ========================================

  class Map {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.getElementById(container)
        : container;

      if (!this.container) {
        throw new Error('Map container not found');
      }

      // Default options
      this.options = {
        center: [0, 0],
        zoom: 2,
        minZoom: 0,
        maxZoom: 19,
        zoomSnap: 1,
        tileSize: 256,
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        zoomControl: true,
        scaleControl: true,
        attributionControl: true,
        maxBounds: null,
        ...options
      };

      // State
      this._center = LatLng.from(this.options.center);
      this._zoom = this.options.zoom;
      this._offset = new Point(0, 0);
      this._size = new Point(
        this.container.clientWidth,
        this.container.clientHeight
      );

      // Interaction state
      this._dragging = false;
      this._lastPointer = null;
      this._pinchStart = null;
      this._animationFrameId = null;

      // Tile management
      this._tiles = new Map();
      this._tileQueue = [];
      this._loading = false;

      // Layers
      this._markers = [];
      this._drawings = [];
      this._layers = {};

      // Initialize
      this._initContainer();
      this._initLayers();
      this._initControls();
      this._initEvents();
      this._render();
    }

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Set map view to center and zoom
     */
    setView(center, zoom, options = {}) {
      this._center = LatLng.from(center);
      if (zoom !== undefined) {
        this._zoom = Util.clamp(
          Math.round(zoom / this.options.zoomSnap) * this.options.zoomSnap,
          this.options.minZoom,
          this.options.maxZoom
        );
      }
      this._offset = new Point(0, 0);

      if (!options.silent) {
        this._render();
        this._fireEvent('moveend');
      }
      return this;
    }

    /**
     * Get current center
     */
    getCenter() {
      return this._center;
    }

    /**
     * Get current zoom level
     */
    getZoom() {
      return this._zoom;
    }

    /**
     * Set zoom level
     */
    setZoom(zoom, options = {}) {
      const newZoom = Util.clamp(
        Math.round(zoom / this.options.zoomSnap) * this.options.zoomSnap,
        this.options.minZoom,
        this.options.maxZoom
      );

      if (newZoom === this._zoom) return this;

      const center = options.around || new Point(this._size.x / 2, this._size.y / 2);
      this._zoomAroundPoint(center, newZoom);

      if (!options.silent) {
        this._fireEvent('zoomend');
      }
      return this;
    }

    /**
     * Zoom in by one level
     */
    zoomIn(options) {
      return this.setZoom(this._zoom + this.options.zoomSnap, options);
    }

    /**
     * Zoom out by one level
     */
    zoomOut(options) {
      return this.setZoom(this._zoom - this.options.zoomSnap, options);
    }

    /**
     * Add marker to map
     */
    addMarker(latlng, options = {}) {
      const marker = new Marker(this, latlng, options);
      this._markers.push(marker);
      this._overlayLayer.appendChild(marker._element);
      marker._updatePosition();
      return marker;
    }

    /**
     * Remove marker from map
     */
    removeMarker(marker) {
      const index = this._markers.indexOf(marker);
      if (index > -1) {
        this._markers.splice(index, 1);
        marker._remove();
      }
      return this;
    }

    /**
     * Convert lat/lng to pixel coordinates
     */
    latLngToContainerPoint(latlng) {
      const ll = LatLng.from(latlng);
      const worldPoint = this._latLngToWorldPoint(ll);
      const containerPoint = worldPoint.subtract(this._getWorldOrigin());
      return containerPoint;
    }

    /**
     * Convert pixel coordinates to lat/lng
     */
    containerPointToLatLng(point) {
      const worldOrigin = this._getWorldOrigin();
      const worldPoint = new Point(point.x + worldOrigin.x, point.y + worldOrigin.y);
      return this._worldPointToLatLng(worldPoint);
    }

    /**
     * Get bounds of the current view
     */
    getBounds() {
      const topLeft = this.containerPointToLatLng(new Point(0, 0));
      const bottomRight = this.containerPointToLatLng(this._size);
      return new Bounds(
        new LatLng(bottomRight.lat, topLeft.lng),
        new LatLng(topLeft.lat, bottomRight.lng)
      );
    }

    /**
     * Fit bounds to view
     */
    fitBounds(bounds, options = {}) {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // Calculate center
      const centerLat = (sw.lat + ne.lat) / 2;
      const centerLng = (sw.lng + ne.lng) / 2;
      const center = new LatLng(centerLat, centerLng);

      // Calculate zoom level to fit bounds
      const topLeft = this._latLngToWorldPoint(ne);
      const bottomRight = this._latLngToWorldPoint(sw);

      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      const scaleX = this._size.x / width;
      const scaleY = this._size.y / height;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% padding

      const zoom = Math.log2(scale) + this._zoom;
      const clampedZoom = Util.clamp(
        Math.floor(zoom / this.options.zoomSnap) * this.options.zoomSnap,
        this.options.minZoom,
        this.options.maxZoom
      );

      this.setView(center, clampedZoom, options);
      return this;
    }

    /**
     * Remove the map
     */
    remove() {
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
      }
      window.removeEventListener('resize', this._onResize);
      this.container.innerHTML = '';
      this.container.classList.remove('m-map', 'm-dragging');
    }

      /**
       * Set a new tile layer
       */
      setTileLayer(url, options = {}) {
        this.options.tileUrl = url;
        if (options.attribution) {
          this.options.attribution = options.attribution;
          if (this._attribution) {
            this._attribution.innerHTML = this.options.attribution;
          }
        }

        // Clear existing tiles
        this._tileLayer.innerHTML = '';
        this._tiles.clear();

        // Re-render
        this._render();
        return this;
      }

    // ========================================
    // LAYER MANAGEMENT
    // ========================================

    /**
     * Add a layer to the map
     */
    addLayer(name, layer) {
      this._layers[name] = layer;
      this.container.appendChild(layer);
      return this;
    }

    /**
     * Remove a layer from the map
     */
    removeLayer(name) {
      if (this._layers[name]) {
        this.container.removeChild(this._layers[name]);
        delete this._layers[name];
      }
      return this;
    }

    /**
     * Get a layer by name
     */
    getLayer(name) {
      return this._layers[name];
    }

    // ========================================
    // SEARCH FUNCTIONALITY
    // ========================================

    /**
     * Search for a location using Nominatim API
     */
    async search(query) {
      if (!query) return null;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
        );
        const results = await response.json();

        if (results.length > 0) {
          const result = results[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          return new LatLng(lat, lng);
        }
        return null;
      } catch (error) {
        console.error('Search error:', error);
        return null;
      }
    }

    // ========================================
    // DRAWING TOOLS
    // ========================================

    /**
     * Start drawing a shape
     */
    startDrawing(type) {
      this._drawingMode = type;
      this.container.style.cursor = 'crosshair';

      // Add temporary drawing layer
      if (!this._drawLayer) {
        this._drawLayer = Util.createEl('svg', 'm-draw-layer', this.container);
      }

      // Add event listeners for drawing
      this.container.addEventListener('click', this._onDrawClick.bind(this));
    }

    /**
     * Stop drawing
     */
    stopDrawing() {
      this._drawingMode = null;
      this.container.style.cursor = '';

      // Remove drawing event listeners
      this.container.removeEventListener('click', this._onDrawClick.bind(this));
    }

    /**
     * Handle drawing click events
     */
    _onDrawClick(e) {
      if (!this._drawingMode) return;

      const point = new Point(e.clientX, e.clientY);
      const latlng = this.containerPointToLatLng(point);

      switch (this._drawingMode) {
        case 'marker':
          this.addMarker(latlng);
          break;
        case 'circle':
          // Create circle drawing element
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.classList.add('m-draw-circle');
          circle.setAttribute('cx', point.x);
          circle.setAttribute('cy', point.y);
          circle.setAttribute('r', 50);
          this._drawLayer.appendChild(circle);

          // Store for later use
          const drawing = {
            type: 'circle',
            element: circle,
            center: latlng
          };
          this._drawings.push(drawing);
          break;
        case 'rectangle':
          // Create rectangle drawing element
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.classList.add('m-draw-rectangle');
          rect.setAttribute('x', point.x - 50);
          rect.setAttribute('y', point.y - 30);
          rect.setAttribute('width', 100);
          rect.setAttribute('height', 60);
          this._drawLayer.appendChild(rect);

          // Store for later use
          const rectDrawing = {
            type: 'rectangle',
            element: rect,
            center: latlng
          };
          this._drawings.push(rectDrawing);
          break;
      }
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    _initContainer() {
      this.container.classList.add('m-map');
      this.container.innerHTML = '';
    }

    _initLayers() {
      // Tile layer
      this._tileLayer = Util.createEl('div', 'm-tile-layer', this.container);

      // Overlay layer (for markers, popups, etc.)
      this._overlayLayer = Util.createEl('div', 'm-overlay-layer', this.container);
    }

    _initControls() {
      if (this.options.zoomControl) {
        this._zoomControl = Util.createEl('div', 'm-zoom-control', this.container);
        const zoomInBtn = Util.createEl('button', '', this._zoomControl);
        zoomInBtn.innerHTML = '+';
        zoomInBtn.addEventListener('click', () => this.zoomIn());

        const zoomOutBtn = Util.createEl('button', '', this._zoomControl);
        zoomOutBtn.innerHTML = '−';
        zoomOutBtn.addEventListener('click', () => this.zoomOut());

        this._updateZoomControl();
      }

      if (this.options.scaleControl) {
        this._scaleControl = Util.createEl('div', 'm-scale-control', this.container);
        this._updateScale();
      }

      if (this.options.attributionControl && this.options.attribution) {
        this._attribution = Util.createEl('div', 'm-attribution', this.container);
        this._attribution.innerHTML = this.options.attribution;
      }
    }

    _initEvents() {
      // Mouse events
      this.container.addEventListener('mousedown', this._onMouseDown.bind(this));
      this.container.addEventListener('mouseup', this._onMouseUp.bind(this));
      this.container.addEventListener('mousemove', this._onMouseMove.bind(this));
      this.container.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

      // Touch events
      this.container.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
      this.container.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
      this.container.addEventListener('touchend', this._onTouchEnd.bind(this));
      this.container.addEventListener('touchcancel', this._onTouchEnd.bind(this));

      // Keyboard navigation
      this.container.addEventListener('keydown', this._onKeyDown.bind(this));

      // Resize handling
      this._onResize = Util.debounce(() => {
        this._size = new Point(
          this.container.clientWidth,
          this.container.clientHeight
        );
        this._render();
        this._fireEvent('resize');
      }, 100);
      window.addEventListener('resize', this._onResize);
    }

    _onMouseDown(e) {
      if (e.button !== 0) return; // Only left mouse button
      e.preventDefault();
      this._dragging = true;
      this._lastPointer = new Point(e.clientX, e.clientY);
      this.container.classList.add('m-dragging');
    }

    _onMouseMove(e) {
      if (!this._dragging) return;
      e.preventDefault();
      const current = new Point(e.clientX, e.clientY);
      const delta = current.subtract(this._lastPointer);
      this._offset = this._offset.add(delta);
      this._lastPointer = current;
      this._render();
      this._fireEvent('drag');
    }

    _onMouseUp(e) {
      if (!this._dragging) return;
      this._dragging = false;
      this.container.classList.remove('m-dragging');
      this._fireEvent('dragend');
      this._render(); // Final render to clean up
    }

    _onWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const factor = e.ctrlKey ? 2 : 1;
      const newZoom = this._zoom + (delta * factor * this.options.zoomSnap);
      this.setZoom(newZoom, { around: new Point(e.clientX, e.clientY) });
    }

    _onTouchStart(e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        this._dragging = true;
        this._lastPointer = new Point(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this._pinchStart = {
          center: Util.midpoint(
            new Point(e.touches[0].clientX, e.touches[0].clientY),
            new Point(e.touches[1].clientX, e.touches[1].clientY)
          ),
          distance: Util.distance(
            new Point(e.touches[0].clientX, e.touches[0].clientY),
            new Point(e.touches[1].clientX, e.touches[1].clientY)
          )
        };
      }
    }

    _onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1 && this._dragging) {
        const current = new Point(e.touches[0].clientX, e.touches[0].clientY);
        const delta = current.subtract(this._lastPointer);
        this._offset = this._offset.add(delta);
        this._lastPointer = current;
        this._render();
      } else if (e.touches.length === 2 && this._pinchStart) {
        const currentCenter = Util.midpoint(
          new Point(e.touches[0].clientX, e.touches[0].clientY),
          new Point(e.touches[1].clientX, e.touches[1].clientY)
        );
        const currentDistance = Util.distance(
          new Point(e.touches[0].clientX, e.touches[0].clientY),
          new Point(e.touches[1].clientX, e.touches[1].clientY)
        );

        const scale = currentDistance / this._pinchStart.distance;
        const zoomDelta = Math.log2(scale);
        const newZoom = this._zoom + zoomDelta;

        this.setZoom(newZoom, { around: currentCenter });
        this._pinchStart = {
          center: currentCenter,
          distance: currentDistance
        };
      }
    }

    _onTouchEnd(e) {
      if (e.touches.length === 0) {
        this._dragging = false;
        this._pinchStart = null;
      }
    }

    _onKeyDown(e) {
      const step = 50;
      let moved = false;

      switch(e.key) {
        case 'ArrowUp':
          this._offset = this._offset.add(new Point(0, step));
          moved = true;
          break;
        case 'ArrowDown':
          this._offset = this._offset.add(new Point(0, -step));
          moved = true;
          break;
        case 'ArrowLeft':
          this._offset = this._offset.add(new Point(step, 0));
          moved = true;
          break;
        case 'ArrowRight':
          this._offset = this._offset.add(new Point(-step, 0));
          moved = true;
          break;
        case '+':
        case '=':
          this.zoomIn();
          break;
        case '-':
          this.zoomOut();
          break;
        case 'Escape':
          // Close any open popups
          this._markers.forEach(marker => {
            if (marker._popup && marker._popup._isOpen) {
              marker._popup._close();
            }
          });
          // Stop drawing if in progress
          if (this._drawingMode) {
            this.stopDrawing();
          }
          break;
      }

      if (moved) {
        e.preventDefault();
        this._render();
      }
    }

    _zoomAroundPoint(point, newZoom) {
      const oldZoom = this._zoom;
      const scale = Math.pow(2, newZoom - oldZoom);

      // Calculate world coordinates of the point before zoom
      const worldOrigin = this._getWorldOrigin();
      const worldPointBefore = new Point(
        point.x + worldOrigin.x,
        point.y + worldOrigin.y
      );

      // Calculate new world origin after zoom
      const newWorldSize = this._getWorldSizeAtZoom(newZoom);
      const oldWorldSize = this._getWorldSizeAtZoom(oldZoom);
      const worldPointAfter = worldPointBefore.multiplyBy(scale);

      const newWorldOrigin = new Point(
        worldPointAfter.x - point.x,
        worldPointAfter.y - point.y
      );

      this._zoom = newZoom;
      this._offset = newWorldOrigin.subtract(this._getInitialWorldOrigin());
      this._render();
    }

    _latLngToWorldPoint(latlng) {
      const x = Util.lngToX(latlng.lng) * this._getWorldSize();
      const y = Util.latToY(latlng.lat) * this._getWorldSize();
      return new Point(x, y);
    }

    _worldPointToLatLng(point) {
      const worldSize = this._getWorldSize();
      const x = point.x / worldSize;
      const y = point.y / worldSize;
      return new LatLng(Util.yToLat(y), Util.xToLng(x));
    }

    _getWorldSize() {
      return this._getWorldSizeAtZoom(this._zoom);
    }

    _getWorldSizeAtZoom(zoom) {
      return Util.TILE_SIZE * Math.pow(2, zoom);
    }

    _getInitialWorldOrigin() {
      const worldSize = this._getWorldSize();
      return new Point(
        (worldSize / 2) - (this._size.x / 2),
        (worldSize / 2) - (this._size.y / 2)
      );
    }

    _getWorldOrigin() {
      const initialOrigin = this._getInitialWorldOrigin();
      return initialOrigin.add(this._offset);
    }

    _render() {
      // Cancel any pending animation frame
      if (this._animationFrameId) {
        cancelAnimationFrame(this._animationFrameId);
      }

      // Use requestAnimationFrame for smoother rendering
      this._animationFrameId = requestAnimationFrame(() => {
        // Update tile layer
        this._updateTiles();

        // Update markers
        this._markers.forEach(marker => marker._updatePosition());

        // Update controls
        if (this._zoomControl) this._updateZoomControl();
        if (this._scaleControl) this._updateScale();

        // Apply CSS transform to tile layer for smooth panning
        const worldOrigin = this._getWorldOrigin();
        const worldSize = this._getWorldSize();

        // Handle world wrapping
        const wrappedOffsetX = worldOrigin.x % worldSize;
        const transform = `translate(${wrappedOffsetX}px, ${worldOrigin.y}px)`;
        this._tileLayer.style.transform = transform;
      });
    }

    _updateTiles() {
      const zoom = Math.round(this._zoom);
      const worldSize = this._getWorldSize();

      // Clear tiles that are no longer needed
      const tilesToRemove = [];
      for (const [key, tile] of this._tiles.entries()) {
        const [z, x, y] = key.split(',').map(Number);
        if (z !== zoom) {
          tilesToRemove.push(key);
        }
      }
      tilesToRemove.forEach(key => {
        this._tileLayer.removeChild(this._tiles.get(key));
        this._tiles.delete(key);
      });

      // Calculate visible tile range
      const bounds = this.getBounds();
      const topLeft = this.latLngToContainerPoint(bounds.getNorthEast());
      const bottomRight = this.latLngToContainerPoint(bounds.getSouthWest());

      const tileCount = Math.pow(2, zoom);
      const minX = Math.max(0, Math.floor((topLeft.x - worldSize) / Util.TILE_SIZE));
      const maxX = Math.min(tileCount - 1, Math.ceil((bottomRight.x + worldSize) / Util.TILE_SIZE));
      const minY = Math.max(0, Math.floor(topLeft.y / Util.TILE_SIZE));
      const maxY = Math.min(tileCount - 1, Math.ceil(bottomRight.y / Util.TILE_SIZE));

      // Add new tiles
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = `${zoom},${x},${y}`;
          if (!this._tiles.has(key)) {
            this._createTile(zoom, x, y, key);
          }
        }
      }
    }

    _createTile(zoom, x, y, key) {
      const tile = Util.createEl('img', 'm-tile', this._tileLayer);
      tile.dataset.key = key;

      // Handle world wrapping
      const tileCount = Math.pow(2, zoom);
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;

      // Select random subdomain
      const subdomain = this.options.subdomains[
        Math.floor(Math.random() * this.options.subdomains.length)
      ];

      const url = this.options.tileUrl
        .replace('{s}', subdomain)
        .replace('{z}', zoom)
        .replace('{x}', wrappedX)
        .replace('{y}', y);

      tile.onload = () => {
        tile.classList.add('loaded');
      };

      tile.onerror = () => {
        tile.classList.add('error');
      };

      tile.style.left = `${x * Util.TILE_SIZE}px`;
      tile.style.top = `${y * Util.TILE_SIZE}px`;
      tile.src = url;

      this._tiles.set(key, tile);
    }

    _updateZoomControl() {
      if (!this._zoomControl) return;
      const zoomInBtn = this._zoomControl.children[0];
      const zoomOutBtn = this._zoomControl.children[1];
      zoomInBtn.disabled = this._zoom >= this.options.maxZoom;
      zoomOutBtn.disabled = this._zoom <= this.options.minZoom;
    }

    _updateScale() {
      if (!this._scaleControl) return;

      // Calculate meters per pixel at current zoom and latitude
      const equatorLength = 2 * Math.PI * Util.EARTH_RADIUS;
      const metersPerPixel = equatorLength / this._getWorldSize();

      // Approximate scale for the current view
      const centerLat = this._center.lat;
      const adjustedMetersPerPixel = metersPerPixel / Math.cos(centerLat * Math.PI / 180);

      // Create scale bar for 100px
      const scaleMeters = adjustedMetersPerPixel * 100;
      let scaleText, scaleValue;

      if (scaleMeters > 1000) {
        scaleValue = Math.round(scaleMeters / 1000);
        scaleText = `${scaleValue} km`;
      } else {
        scaleValue = Math.round(scaleMeters);
        scaleText = `${scaleValue} m`;
      }

      this._scaleControl.textContent = scaleText;
    }

    _fireEvent(type) {
      // Simple event system - can be extended later
      this.container.dispatchEvent(new CustomEvent(type, { detail: { target: this } }));
    }
  }

  // ========================================
  // MARKER CLASS
  // ========================================

  class Marker {
    constructor(map, latlng, options = {}) {
      this._map = map;
      this._latlng = LatLng.from(latlng);
      this._options = options;
      this._popup = null;

      this._initElement();
      this._initEvents();
    }

    _initElement() {
      this._element = Util.createEl('div', 'm-marker');

      const icon = Util.createEl('div', 'm-marker-icon', this._element);
      Util.createEl('div', 'm-marker-shadow', icon);
      Util.createEl('div', 'm-marker-dot', icon);

      if (this._options.title) {
        this._element.title = this._options.title;
      }
    }

    _initEvents() {
      this._element.addEventListener('click', (e) => {
        e.stopPropagation();
        this._fireEvent('click');
        if (this._popup) {
          this._popup._toggle();
        }
      });
    }

    _updatePosition() {
      const point = this._map.latLngToContainerPoint(this._latlng);
      this._element.style.left = `${point.x}px`;
      this._element.style.top = `${point.y}px`;
    }

    setLatLng(latlng) {
      this._latlng = LatLng.from(latlng);
      this._updatePosition();
      return this;
    }

    getLatLng() {
      return this._latlng;
    }

    bindPopup(content, options = {}) {
      if (this._popup) {
        this._popup._remove();
      }
      this._popup = new Popup(this._map, content, options);
      this._popup._setTarget(this);
      return this;
    }

    openPopup() {
      if (this._popup) {
        this._popup._open();
      }
      return this;
    }

    closePopup() {
      if (this._popup) {
        this._popup._close();
      }
      return this;
    }

    _remove() {
      if (this._popup) {
        this._popup._remove();
      }
      if (this._element.parentNode) {
        this._element.parentNode.removeChild(this._element);
      }
    }

    _fireEvent(type) {
      this._element.dispatchEvent(new CustomEvent(type, { detail: { target: this } }));
    }
  }

  // ========================================
  // POPUP CLASS
  // ========================================

  class Popup {
    constructor(map, content, options = {}) {
      this._map = map;
      this._content = content;
      this._options = {
        closeButton: true,
        autoClose: true,
        ...options
      };
      this._isOpen = false;
      this._target = null;
    }

    _initElement() {
      this._element = Util.createEl('div', 'm-popup');

      if (this._options.closeButton) {
        this._closeButton = Util.createEl('button', 'm-popup-close', this._element);
        this._closeButton.innerHTML = '×';
        this._closeButton.addEventListener('click', () => this._close());
      }

      this._contentElement = Util.createEl('div', 'm-popup-content', this._element);
      this._contentElement.innerHTML = this._content;
    }

    _setTarget(marker) {
      this._target = marker;
    }

    _open() {
      if (!this._element) {
        this._initElement();
      }

      if (this._options.autoClose) {
        // Close other popups
        this._map._markers.forEach(marker => {
          if (marker._popup && marker._popup !== this) {
            marker._popup._close();
          }
        });
      }

      this._map._overlayLayer.appendChild(this._element);
      this._isOpen = true;
      this._updatePosition();

      // Update position on map move
      this._moveHandler = () => this._updatePosition();
      this._map.container.addEventListener('moveend', this._moveHandler);
    }

    _close() {
      if (this._isOpen && this._element.parentNode) {
        this._element.parentNode.removeChild(this._element);
        this._isOpen = false;
        if (this._moveHandler) {
          this._map.container.removeEventListener('moveend', this._moveHandler);
          this._moveHandler = null;
        }
      }
    }

    _toggle() {
      if (this._isOpen) {
        this._close();
      } else {
        this._open();
      }
    }

    _updatePosition() {
      if (!this._isOpen || !this._target) return;

      const targetPoint = this._map.latLngToContainerPoint(this._target.getLatLng());
      const popupWidth = this._element.offsetWidth;
      const popupHeight = this._element.offsetHeight;

      this._element.style.left = `${targetPoint.x - popupWidth / 2}px`;
      this._element.style.top = `${targetPoint.y - popupHeight - 10}px`;
    }

    _remove() {
      this._close();
      this._element = null;
    }
  }

  // ========================================
  // EXPORT TO GLOBAL
  // ========================================

  global.MiniAtlas = {
    Map,
    Marker,
    Popup,
    LatLng,
    Point,
    Bounds,
    version: '1.0.0'
  };

  // Convenience function
  global.miniatlas = function(container, options) {
    return new Map(container, options);
  };

})(typeof window !== 'undefined' ? window : global);