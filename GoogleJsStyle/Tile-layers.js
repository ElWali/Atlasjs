/**
 * Base class for tile layers.
 * @extends {Layer}
 */
const GridLayer = Layer.extend(/** @lends GridLayer.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    tileSize: 256,
    opacity: 1,
    updateWhenIdle: Browser.mobile,
    updateWhenZooming: true,
    updateInterval: 200,
    zIndex: 1,
    bounds: null,
    minZoom: 0,
    maxZoom: undefined,
    maxNativeZoom: undefined,
    minNativeZoom: undefined,
    noWrap: false,
    pane: 'tilePane',
    className: '',
    keepBuffer: 2,
  },

  /**
   * @param {Object=} options Layer options.
   */
  initialize: function(options) {
    setOptions(this, options);
  },

  /**
   * Called when added to map.
   */
  onAdd: function() {
    this._initContainer();
    this._levels = {};
    this._tiles = {};
    this._resetView();
  },

  /**
   * Called before adding to map.
   * @param {!Map} map Map instance.
   */
  beforeAdd: function(map) {
    map._addZoomLimit(this);
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    this._removeAllTiles();
    remove(this._container);
    map._removeZoomLimit(this);
    this._container = null;
    this._tileZoom = undefined;
  },

  /**
   * Brings layer to front.
   * @return {!GridLayer} This layer.
   */
  bringToFront: function() {
    if (this._map) {
      toFront(this._container);
      this._setAutoZIndex(Math.max);
    }
    return this;
  },

  /**
   * Brings layer to back.
   * @return {!GridLayer} This layer.
   */
  bringToBack: function() {
    if (this._map) {
      toBack(this._container);
      this._setAutoZIndex(Math.min);
    }
    return this;
  },

  /**
   * Gets container element.
   * @return {Element} Container.
   */
  getContainer: function() {
    return this._container;
  },

  /**
   * Sets layer opacity.
   * @param {number} opacity Opacity value (0–1).
   * @return {!GridLayer} This layer.
   */
  setOpacity: function(opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },

  /**
   * Sets z-index.
   * @param {number} zIndex Z-index value.
   * @return {!GridLayer} This layer.
   */
  setZIndex: function(zIndex) {
    this.options.zIndex = zIndex;
    this._updateZIndex();
    return this;
  },

  /**
   * Checks if layer is loading tiles.
   * @return {boolean} Whether loading.
   */
  isLoading: function() {
    return this._loading;
  },

  /**
   * Redraws layer.
   * @return {!GridLayer} This layer.
   */
  redraw: function() {
    if (this._map) {
      this._removeAllTiles();
      const tileZoom = this._clampZoom(this._map.getZoom());
      if (tileZoom !== this._tileZoom) {
        this._tileZoom = tileZoom;
        this._updateLevels();
      }
      this._update();
    }
    return this;
  },

  /**
   * Gets events handled by layer.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = {
      viewprereset: this._invalidateAll,
      viewreset: this._resetView,
      zoom: this._resetView,
      moveend: this._onMoveEnd,
    };
    if (!this.options.updateWhenIdle) {
      if (!this._onMove) {
        this._onMove = throttle(this._onMoveEnd, this.options.updateInterval, this);
      }
      events.move = this._onMove;
    }
    if (this._zoomAnimated) {
      events.zoomanim = this._animateZoom;
    }
    return events;
  },

  /**
   * Creates tile element.
   * @return {!Element} Tile element.
   */
  createTile: function() {
    return document.createElement('div');
  },

  /**
   * Gets tile size.
   * @return {!Point} Tile size.
   */
  getTileSize: function() {
    const s = this.options.tileSize;
    return s instanceof Point ? s : new Point(s, s);
  },

  /**
   * Updates z-index.
   * @private
   */
  _updateZIndex: function() {
    if (this._container && this.options.zIndex !== undefined &&
        this.options.zIndex !== null) {
      this._container.style.zIndex = this.options.zIndex;
    }
  },

  /**
   * Sets automatic z-index.
   * @param {Function} compare Comparison function.
   * @private
   */
  _setAutoZIndex: function(compare) {
    const layers = this.getPane().children;
    const edgeZIndex = -compare(-Infinity, Infinity);
    for (let i = 0, len = layers.length, zIndex; i < len; i++) {
      zIndex = layers[i].style.zIndex;
      if (layers[i] !== this._container && zIndex) {
        edgeZIndex = compare(edgeZIndex, +zIndex);
      }
    }
    if (isFinite(edgeZIndex)) {
      this.options.zIndex = edgeZIndex + compare(-1, 1);
      this._updateZIndex();
    }
  },

  /**
   * Updates opacity with fade animation.
   * @private
   */
  _updateOpacity: function() {
    if (!this._map) {
      return;
    }
    setOpacity(this._container, this.options.opacity);
    const now = +new Date();
    let nextFrame = false;
    let willPrune = false;
    for (const key in this._tiles) {
      const tile = this._tiles[key];
      if (!tile.current || !tile.loaded) {
        continue;
      }
      const fade = Math.min(1, (now - tile.loaded) / 200);
      setOpacity(tile.el, fade);
      if (fade < 1) {
        nextFrame = true;
      } else {
        if (tile.active) {
          willPrune = true;
        } else {
          this._onOpaqueTile(tile);
        }
        tile.active = true;
      }
    }
    if (willPrune && !this._noPrune) {
      this._pruneTiles();
    }
    if (nextFrame) {
      cancelAnimFrame(this._fadeFrame);
      this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
    }
  },

  /**
   * Handles opaque tile.
   * @param {!Object} tile Tile object.
   * @private
   */
  _onOpaqueTile: falseFn,

  /**
   * Initializes container.
   * @private
   */
  _initContainer: function() {
    if (this._container) {
      return;
    }
    this._container = create$1('div', 'atlas-layer ' + (this.options.className || ''));
    this._updateZIndex();
    if (this.options.opacity < 1) {
      this._updateOpacity();
    }
    this.getPane().appendChild(this._container);
  },

  /**
   * Updates zoom levels.
   * @return {Object|undefined} Current level.
   * @private
   */
  _updateLevels: function() {
    const zoom = this._tileZoom;
    const maxZoom = this.options.maxZoom;
    if (zoom === undefined) {
      return undefined;
    }
    for (const z in this._levels) {
      const zNum = Number(z);
      if (this._levels[zNum].el.children.length || zNum === zoom) {
        this._levels[zNum].el.style.zIndex = maxZoom - Math.abs(zoom - zNum);
        this._onUpdateLevel(zNum);
      } else {
        remove(this._levels[zNum].el);
        this._removeTilesAtZoom(zNum);
        this._onRemoveLevel(zNum);
        delete this._levels[zNum];
      }
    }
    let level = this._levels[zoom];
    const map = this._map;
    if (!level) {
      level = this._levels[zoom] = {};
      level.el = create$1('div', 'atlas-tile-container atlas-zoom-animated', this._container);
      level.el.style.zIndex = maxZoom;
      level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
      level.zoom = zoom;
      this._setZoomTransform(level, map.getCenter(), map.getZoom());
      falseFn(level.el.offsetWidth);
      this._onCreateLevel(level);
    }
    this._level = level;
    return level;
  },

  /**
   * Handles level update.
   * @param {number} z Zoom level.
   * @private
   */
  _onUpdateLevel: falseFn,

  /**
   * Handles level removal.
   * @param {number} z Zoom level.
   * @private
   */
  _onRemoveLevel: falseFn,

  /**
   * Handles level creation.
   * @param {!Object} level Level object.
   * @private
   */
  _onCreateLevel: falseFn,

  /**
   * Prunes unused tiles.
   * @private
   */
  _pruneTiles: function() {
    if (!this._map) {
      return;
    }
    let key;
    let tile;
    const zoom = this._map.getZoom();
    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      this._removeAllTiles();
      return;
    }
    for (key in this._tiles) {
      tile = this._tiles[key];
      tile.retain = tile.current;
    }
    for (key in this._tiles) {
      tile = this._tiles[key];
      if (tile.current && !tile.active) {
        const coords = tile.coords;
        if (!this._retainParent(coords.x, coords.y, coords.z, coords.z - 5)) {
          this._retainChildren(coords.x, coords.y, coords.z, coords.z + 2);
        }
      }
    }
    for (key in this._tiles) {
      if (!this._tiles[key].retain) {
        this._removeTile(key);
      }
    }
  },

  /**
   * Removes tiles at specific zoom.
   * @param {number} zoom Zoom level.
   * @private
   */
  _removeTilesAtZoom: function(zoom) {
    for (const key in this._tiles) {
      if (this._tiles[key].coords.z !== zoom) {
        continue;
      }
      this._removeTile(key);
    }
  },

  /**
   * Removes all tiles.
   * @private
   */
  _removeAllTiles: function() {
    for (const key in this._tiles) {
      this._removeTile(key);
    }
  },

  /**
   * Invalidates all levels and tiles.
   * @private
   */
  _invalidateAll: function() {
    for (const z in this._levels) {
      remove(this._levels[z].el);
      this._onRemoveLevel(Number(z));
      delete this._levels[z];
    }
    this._removeAllTiles();
    this._tileZoom = undefined;
  },

  /**
   * Retains parent tile.
   * @param {number} x X coordinate.
   * @param {number} y Y coordinate.
   * @param {number} z Zoom level.
   * @param {number} minZoom Minimum zoom.
   * @return {boolean} Whether retained.
   * @private
   */
  _retainParent: function(x, y, z, minZoom) {
    const x2 = Math.floor(x / 2);
    const y2 = Math.floor(y / 2);
    const z2 = z - 1;
    const coords2 = new Point(+x2, +y2);
    coords2.z = +z2;
    const key = this._tileCoordsToKey(coords2);
    const tile = this._tiles[key];
    if (tile && tile.active) {
      tile.retain = true;
      return true;
    } else if (tile && tile.loaded) {
      tile.retain = true;
    }
    if (z2 > minZoom) {
      return this._retainParent(x2, y2, z2, minZoom);
    }
    return false;
  },

  /**
   * Retains child tiles.
   * @param {number} x X coordinate.
   * @param {number} y Y coordinate.
   * @param {number} z Zoom level.
   * @param {number} maxZoom Maximum zoom.
   * @private
   */
  _retainChildren: function(x, y, z, maxZoom) {
    for (let i = 2 * x; i < 2 * x + 2; i++) {
      for (let j = 2 * y; j < 2 * y + 2; j++) {
        const coords = new Point(i, j);
        coords.z = z + 1;
        const key = this._tileCoordsToKey(coords);
        const tile = this._tiles[key];
        if (tile && tile.active) {
          tile.retain = true;
          continue;
        } else if (tile && tile.loaded) {
          tile.retain = true;
        }
        if (z + 1 < maxZoom) {
          this._retainChildren(i, j, z + 1, maxZoom);
        }
      }
    }
  },

  /**
   * Resets view.
   * @param {Object=} e Event.
   * @private
   */
  _resetView: function(e) {
    const animating = e && (e.pinch || e.flyTo);
    this._setView(this._map.getCenter(), this._map.getZoom(), animating, animating);
  },

  /**
   * Animates zoom.
   * @param {!Object} e Zoom event.
   * @private
   */
  _animateZoom: function(e) {
    this._setView(e.center, e.zoom, true, e.noUpdate);
  },

  /**
   * Clamps zoom to native limits.
   * @param {number} zoom Zoom level.
   * @return {number} Clamped zoom.
   * @private
   */
  _clampZoom: function(zoom) {
    const options = this.options;
    if (options.minNativeZoom !== undefined && zoom < options.minNativeZoom) {
      return options.minNativeZoom;
    }
    if (options.maxNativeZoom !== undefined && options.maxNativeZoom < zoom) {
      return options.maxNativeZoom;
    }
    return zoom;
  },

  /**
   * Sets view with tile management.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @param {boolean} noPrune Whether to skip pruning.
   * @param {boolean} noUpdate Whether to skip update.
   * @private
   */
  _setView: function(center, zoom, noPrune, noUpdate) {
    let tileZoom = Math.round(zoom);
    if ((this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
        (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)) {
      tileZoom = undefined;
    } else {
      tileZoom = this._clampZoom(tileZoom);
    }
    const tileZoomChanged = this.options.updateWhenZooming && (tileZoom !== this._tileZoom);
    if (!noUpdate || tileZoomChanged) {
      this._tileZoom = tileZoom;
      if (this._abortLoading) {
        this._abortLoading();
      }
      this._updateLevels();
      this._resetGrid();
      if (tileZoom !== undefined) {
        this._update(center);
      }
      if (!noPrune) {
        this._pruneTiles();
      }
      this._noPrune = !!noPrune;
    }
    this._setZoomTransforms(center, zoom);
  },

  /**
   * Sets zoom transforms for all levels.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @private
   */
  _setZoomTransforms: function(center, zoom) {
    for (const i in this._levels) {
      this._setZoomTransform(this._levels[i], center, zoom);
    }
  },

  /**
   * Sets zoom transform for level.
   * @param {!Object} level Level object.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @private
   */
  _setZoomTransform: function(level, center, zoom) {
    const scale = this._map.getZoomScale(zoom, level.zoom);
    const translate = level.origin.multiplyBy(scale)
        .subtract(this._map._getNewPixelOrigin(center, zoom)).round();
    if (Browser.any3d) {
      setTransform(level.el, translate, scale);
    } else {
      setPosition(level.el, translate);
    }
  },

  /**
   * Resets grid parameters.
   * @private
   */
  _resetGrid: function() {
    const map = this._map;
    const crs = map.options.crs;
    const tileSize = this._tileSize = this.getTileSize();
    const tileZoom = this._tileZoom;
    const bounds = this._map.getPixelWorldBounds(this._tileZoom);
    if (bounds) {
      this._globalTileRange = this._pxBoundsToTileRange(bounds);
    }
    this._wrapX = crs.wrapLng && !this.options.noWrap && [
      Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize.x),
      Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize.y),
    ];
    this._wrapY = crs.wrapLat && !this.options.noWrap && [
      Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize.x),
      Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize.y),
    ];
  },

  /**
   * Handles move end.
   * @private
   */
  _onMoveEnd: function() {
    if (!this._map || this._map._animatingZoom) {
      return;
    }
    this._update();
  },

  /**
   * Gets tiled pixel bounds.
   * @param {!LatLng|number[]} center Center.
   * @return {!Bounds} Pixel bounds.
   * @private
   */
  _getTiledPixelBounds: function(center) {
    const map = this._map;
    const mapZoom = map._animatingZoom ?
        Math.max(map._animateToZoom, map.getZoom()) : map.getZoom();
    const scale = map.getZoomScale(mapZoom, this._tileZoom);
    const pixelCenter = map.project(center, this._tileZoom).floor();
    const halfSize = map.getSize().divideBy(scale * 2);
    return new Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
  },

  /**
   * Updates visible tiles.
   * @param {!LatLng|number[]=} center Center.
   * @private
   */
  _update: function(center) {
    const map = this._map;
    if (!map) {
      return;
    }
    const zoom = this._clampZoom(map.getZoom());
    if (center === undefined) {
      center = map.getCenter();
    }
    if (this._tileZoom === undefined) {
      return;
    }
    const pixelBounds = this._getTiledPixelBounds(center);
    const tileRange = this._pxBoundsToTileRange(pixelBounds);
    const tileCenter = tileRange.getCenter();
    const queue = [];
    const margin = this.options.keepBuffer;
    const noPruneRange = new Bounds(
        tileRange.getBottomLeft().subtract([margin, -margin]),
        tileRange.getTopRight().add([margin, -margin]));
    if (!(isFinite(tileRange.min.x) && isFinite(tileRange.min.y) &&
          isFinite(tileRange.max.x) && isFinite(tileRange.max.y))) {
      throw new Error('Attempted to load an infinite number of tiles');
    }
    for (const key in this._tiles) {
      const c = this._tiles[key].coords;
      if (c.z !== this._tileZoom || !noPruneRange.contains(new Point(c.x, c.y))) {
        this._tiles[key].current = false;
      }
    }
    if (Math.abs(zoom - this._tileZoom) > 1) {
      this._setView(center, zoom);
      return;
    }
    for (let j = tileRange.min.y; j <= tileRange.max.y; j++) {
      for (let i = tileRange.min.x; i <= tileRange.max.x; i++) {
        const coords = new Point(i, j);
        coords.z = this._tileZoom;
        if (!this._isValidTile(coords)) {
          continue;
        }
        const tile = this._tiles[this._tileCoordsToKey(coords)];
        if (tile) {
          tile.current = true;
        } else {
          queue.push(coords);
        }
      }
    }
    queue.sort(function(a, b) {
      return a.distanceTo(tileCenter) - b.distanceTo(tileCenter);
    });
    if (queue.length !== 0) {
      if (!this._loading) {
        this._loading = true;
        this.fire('loading');
      }
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < queue.length; i++) {
        this._addTile(queue[i], fragment);
      }
      this._level.el.appendChild(fragment);
    }
  },

  /**
   * Checks if tile coordinates are valid.
   * @param {!Point} coords Tile coordinates.
   * @return {boolean} Whether valid.
   * @private
   */
  _isValidTile: function(coords) {
    const crs = this._map.options.crs;
    if (!crs.infinite) {
      const bounds = this._globalTileRange;
      if ((!crs.wrapLng && (coords.x < bounds.min.x || coords.x > bounds.max.x)) ||
          (!crs.wrapLat && (coords.y < bounds.min.y || coords.y > bounds.max.y))) {
        return false;
      }
    }
    if (!this.options.bounds) {
      return true;
    }
    const tileBounds = this._tileCoordsToBounds(coords);
    return toLatLngBounds(this.options.bounds).overlaps(tileBounds);
  },

  /**
   * Converts tile key to bounds.
   * @param {string} key Tile key.
   * @return {!LatLngBounds} Bounds.
   * @private
   */
  _keyToBounds: function(key) {
    return this._tileCoordsToBounds(this._keyToTileCoords(key));
  },

  /**
   * Converts tile coordinates to northwest/southeast points.
   * @param {!Point} coords Tile coordinates.
   * @return {LatLng[]} Corner points.
   * @private
   */
  _tileCoordsToNwSe: function(coords) {
    const map = this._map;
    const tileSize = this.getTileSize();
    const nwPoint = coords.scaleBy(tileSize);
    const sePoint = nwPoint.add(tileSize);
    const nw = map.unproject(nwPoint, coords.z);
    const se = map.unproject(sePoint, coords.z);
    return [nw, se];
  },

  /**
   * Converts tile coordinates to bounds.
   * @param {!Point} coords Tile coordinates.
   * @return {!LatLngBounds} Bounds.
   * @private
   */
  _tileCoordsToBounds: function(coords) {
    const bp = this._tileCoordsToNwSe(coords);
    let bounds = new LatLngBounds(bp[0], bp[1]);
    if (!this.options.noWrap) {
      bounds = this._map.wrapLatLngBounds(bounds);
    }
    return bounds;
  },

  /**
   * Converts tile coordinates to key string.
   * @param {!Point} coords Tile coordinates.
   * @return {string} Key string.
   * @private
   */
  _tileCoordsToKey: function(coords) {
    return coords.x + ':' + coords.y + ':' + coords.z;
  },

  /**
   * Converts key string to tile coordinates.
   * @param {string} key Key string.
   * @return {!Point} Tile coordinates.
   * @private
   */
  _keyToTileCoords: function(key) {
    const k = key.split(':');
    const coords = new Point(+k[0], +k[1]);
    coords.z = +k[2];
    return coords;
  },

  /**
   * Removes tile by key.
   * @param {string} key Tile key.
   * @private
   */
  _removeTile: function(key) {
    const tile = this._tiles[key];
    if (!tile) {
      return;
    }
    remove(tile.el);
    delete this._tiles[key];
    this.fire('tileunload', {
      tile: tile.el,
      coords: this._keyToTileCoords(key),
    });
  },

  /**
   * Initializes tile element.
   * @param {!Element} tile Tile element.
   * @private
   */
  _initTile: function(tile) {
    addClass(tile, 'atlas-tile');
    const tileSize = this.getTileSize();
    tile.style.width = tileSize.x + 'px';
    tile.style.height = tileSize.y + 'px';
    tile.onselectstart = falseFn;
    tile.onmousemove = falseFn;
    if (Browser.ielt9 && this.options.opacity < 1) {
      setOpacity(tile, this.options.opacity);
    }
  },

  /**
   * Adds tile to container.
   * @param {!Point} coords Tile coordinates.
   * @param {!DocumentFragment} container Container fragment.
   * @private
   */
  _addTile: function(coords, container) {
    const tilePos = this._getTilePos(coords);
    const key = this._tileCoordsToKey(coords);
    const tile = this.createTile(this._wrapCoords(coords),
        bind(this._tileReady, this, coords));
    this._initTile(tile);
    if (this.createTile.length < 2) {
      requestAnimFrame(bind(this._tileReady, this, coords, null, tile));
    }
    setPosition(tile, tilePos);
    this._tiles[key] = {
      el: tile,
      coords: coords,
      current: true,
    };
    container.appendChild(tile);
    this.fire('tileloadstart', {
      tile: tile,
      coords: coords,
    });
  },

  /**
   * Handles tile ready state.
   * @param {!Point} coords Tile coordinates.
   * @param {Error=} err Error object.
   * @param {!Element} tile Tile element.
   * @private
   */
  _tileReady: function(coords, err, tile) {
    if (err) {
      this.fire('tileerror', {
        error: err,
        tile: tile,
        coords: coords,
      });
    }
    const key = this._tileCoordsToKey(coords);
    tile = this._tiles[key];
    if (!tile) {
      return;
    }
    tile.loaded = +new Date();
    if (this._map._fadeAnimated) {
      setOpacity(tile.el, 0);
      cancelAnimFrame(this._fadeFrame);
      this._fadeFrame = requestAnimFrame(this._updateOpacity, this);
    } else {
      tile.active = true;
      this._pruneTiles();
    }
    if (!err) {
      addClass(tile.el, 'atlas-tile-loaded');
      this.fire('tileload', {
        tile: tile.el,
        coords: coords,
      });
    }
    if (this._noTilesToLoad()) {
      this._loading = false;
      this.fire('load');
      if (Browser.ielt9 || !this._map._fadeAnimated) {
        requestAnimFrame(this._pruneTiles, this);
      } else {
        setTimeout(bind(this._pruneTiles, this), 250);
      }
    }
  },

  /**
   * Gets tile position.
   * @param {!Point} coords Tile coordinates.
   * @return {!Point} Position.
   * @private
   */
  _getTilePos: function(coords) {
    return coords.scaleBy(this.getTileSize()).subtract(this._level.origin);
  },

  /**
   * Wraps tile coordinates.
   * @param {!Point} coords Tile coordinates.
   * @return {!Point} Wrapped coordinates.
   * @private
   */
  _wrapCoords: function(coords) {
    const newCoords = new Point(
        this._wrapX ? wrapNum(coords.x, this._wrapX) : coords.x,
        this._wrapY ? wrapNum(coords.y, this._wrapY) : coords.y);
    newCoords.z = coords.z;
    return newCoords;
  },

  /**
   * Converts pixel bounds to tile range.
   * @param {!Bounds} bounds Pixel bounds.
   * @return {!Bounds} Tile range.
   * @private
   */
  _pxBoundsToTileRange: function(bounds) {
    const tileSize = this.getTileSize();
    return new Bounds(
        bounds.min.unscaleBy(tileSize).floor(),
        bounds.max.unscaleBy(tileSize).ceil().subtract([1, 1]));
  },

  /**
   * Checks if all tiles are loaded.
   * @return {boolean} Whether all loaded.
   * @private
   */
  _noTilesToLoad: function() {
    for (const key in this._tiles) {
      if (!this._tiles[key].loaded) {
        return false;
      }
    }
    return true;
  },
});

/**
 * Creates a grid layer.
 * @param {Object=} options Layer options.
 * @return {!GridLayer} New grid layer.
 */
function gridLayer(options) {
  return new GridLayer(options);
}

/**
 * Standard tile layer for raster tiles.
 * @extends {GridLayer}
 */
const TileLayer = GridLayer.extend(/** @lends TileLayer.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    minZoom: 0,
    maxZoom: 18,
    subdomains: 'abc',
    errorTileUrl: '',
    zoomOffset: 0,
    tms: false,
    zoomReverse: false,
    detectRetina: false,
    crossOrigin: false,
    referrerPolicy: false,
  },

  /**
   * @param {string} url Tile URL template.
   * @param {Object=} options Layer options.
   */
  initialize: function(url, options) {
    this._url = url;
    options = setOptions(this, options);
    if (options.detectRetina && Browser.retina && options.maxZoom > 0) {
      options.tileSize = Math.floor(options.tileSize / 2);
      if (!options.zoomReverse) {
        options.zoomOffset++;
        options.maxZoom = Math.max(options.minZoom, options.maxZoom - 1);
      } else {
        options.zoomOffset--;
        options.minZoom = Math.min(options.maxZoom, options.minZoom + 1);
      }
      options.minZoom = Math.max(0, options.minZoom);
    } else if (!options.zoomReverse) {
      options.maxZoom = Math.max(options.minZoom, options.maxZoom);
    } else {
      options.minZoom = Math.min(options.maxZoom, options.minZoom);
    }
    if (typeof options.subdomains === 'string') {
      options.subdomains = options.subdomains.split('');
    }
    this.on('tileunload', this._onTileRemove);
  },

  /**
   * Sets tile URL template.
   * @param {string} url New URL template.
   * @param {boolean=} noRedraw Whether to skip redraw.
   * @return {!TileLayer} This layer.
   */
  setUrl: function(url, noRedraw) {
    if (this._url === url && noRedraw === undefined) {
      noRedraw = true;
    }
    this._url = url;
    if (!noRedraw) {
      this.redraw();
    }
    return this;
  },

  /**
   * Creates tile element (img).
   * @param {!Point} coords Tile coordinates.
   * @param {Function} done Callback.
   * @return {!Element} Image element.
   */
  createTile: function(coords, done) {
    const tile = document.createElement('img');
    on(tile, 'load', bind(this._tileOnLoad, this, done, tile));
    on(tile, 'error', bind(this._tileOnError, this, done, tile));
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' :
          this.options.crossOrigin;
    }
    if (typeof this.options.referrerPolicy === 'string') {
      tile.referrerPolicy = this.options.referrerPolicy;
    }
    tile.alt = '';
    tile.src = this.getTileUrl(coords);
    return tile;
  },

  /**
   * Gets tile URL.
   * @param {!Point} coords Tile coordinates.
   * @return {string} Tile URL.
   */
  getTileUrl: function(coords) {
    const data = {
      r: Browser.retina ? '@2x' : '',
      s: this._getSubdomain(coords),
      x: coords.x,
      y: coords.y,
      z: this._getZoomForUrl(),
    };
    if (this._map && !this._map.options.crs.infinite) {
      const invertedY = this._globalTileRange.max.y - coords.y;
      if (this.options.tms) {
        data['y'] = invertedY;
      }
      data['-y'] = invertedY;
    }
    return template(this._url, extend(data, this.options));
  },

  /**
   * Handles tile load.
   * @param {Function} done Callback.
   * @param {!Element} tile Tile element.
   * @private
   */
  _tileOnLoad: function(done, tile) {
    if (Browser.ielt9) {
      setTimeout(bind(done, this, null, tile), 0);
    } else {
      done(null, tile);
    }
  },

  /**
   * Handles tile error.
   * @param {Function} done Callback.
   * @param {!Element} tile Tile element.
   * @param {Event} e Error event.
   * @private
   */
  _tileOnError: function(done, tile, e) {
    const errorUrl = this.options.errorTileUrl;
    if (errorUrl && tile.getAttribute('src') !== errorUrl) {
      tile.src = errorUrl;
    }
    done(e, tile);
  },

  /**
   * Handles tile removal.
   * @param {!Object} e Event.
   * @private
   */
  _onTileRemove: function(e) {
    e.tile.onload = null;
  },

  /**
   * Gets zoom for URL.
   * @return {number} Zoom level.
   * @private
   */
  _getZoomForUrl: function() {
    let zoom = this._tileZoom;
    const maxZoom = this.options.maxZoom;
    const zoomReverse = this.options.zoomReverse;
    const zoomOffset = this.options.zoomOffset;
    if (zoomReverse) {
      zoom = maxZoom - zoom;
    }
    return zoom + zoomOffset;
  },

  /**
   * Gets subdomain for tile.
   * @param {!Point} tilePoint Tile coordinates.
   * @return {string} Subdomain.
   * @private
   */
  _getSubdomain: function(tilePoint) {
    const index = Math.abs(tilePoint.x + tilePoint.y) %
        this.options.subdomains.length;
    return this.options.subdomains[index];
  },

  /**
   * Aborts tile loading.
   * @private
   */
  _abortLoading: function() {
    let tile;
    for (const i in this._tiles) {
      if (this._tiles[i].coords.z !== this._tileZoom) {
        tile = this._tiles[i].el;
        tile.onload = falseFn;
        tile.onerror = falseFn;
        if (!tile.complete) {
          tile.src = emptyImageUrl;
          const coords = this._tiles[i].coords;
          remove(tile);
          delete this._tiles[i];
          this.fire('tileabort', {
            tile: tile,
            coords: coords,
          });
        }
      }
    }
  },

  /**
   * Removes tile.
   * @param {string} key Tile key.
   * @private
   */
  _removeTile: function(key) {
    const tile = this._tiles[key];
    if (!tile) {
      return;
    }
    tile.el.setAttribute('src', emptyImageUrl);
    return GridLayer.prototype._removeTile.call(this, key);
  },

  /**
   * Handles tile ready state.
   * @param {!Point} coords Tile coordinates.
   * @param {Error=} err Error object.
   * @param {!Element} tile Tile element.
   * @private
   */
  _tileReady: function(coords, err, tile) {
    if (!this._map ||
        (tile && tile.getAttribute('src') === emptyImageUrl)) {
      return;
    }
    return GridLayer.prototype._tileReady.call(this, coords, err, tile);
  },
});

/**
 * Creates a tile layer.
 * @param {string} url Tile URL template.
 * @param {Object=} options Layer options.
 * @return {!TileLayer} New tile layer.
 */
function tileLayer(url, options) {
  return new TileLayer(url, options);
}

/**
 * WMS tile layer.
 * @extends {TileLayer}
 */
const TileLayerWMS = TileLayer.extend(/** @lends TileLayerWMS.prototype */ {
  /**
   * @type {!Object}
   */
  defaultWmsParams: {
    service: 'WMS',
    request: 'GetMap',
    layers: '',
    styles: '',
    format: 'image/jpeg',
    transparent: false,
    version: '1.1.1',
  },

  /**
   * @type {!Object}
   */
  options: {
    crs: null,
    uppercase: false,
  },

  /**
   * @param {string} url WMS service URL.
   * @param {Object=} options Layer options.
   */
  initialize: function(url, options) {
    this._url = url;
    const wmsParams = extend({}, this.defaultWmsParams);
    for (const i in options) {
      if (!(i in this.options)) {
        wmsParams[i] = options[i];
      }
    }
    options = setOptions(this, options);
    const realRetina = options.detectRetina && Browser.retina ? 2 : 1;
    const tileSize = this.getTileSize();
    wmsParams.width = tileSize.x * realRetina;
    wmsParams.height = tileSize.y * realRetina;
    this.wmsParams = wmsParams;
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   */
  onAdd: function(map) {
    this._crs = this.options.crs || map.options.crs;
    this._wmsVersion = parseFloat(this.wmsParams.version);
    const projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
    this.wmsParams[projectionKey] = this._crs.code;
    TileLayer.prototype.onAdd.call(this, map);
  },

  /**
   * Gets tile URL.
   * @param {!Point} coords Tile coordinates.
   * @return {string} Tile URL.
   */
  getTileUrl: function(coords) {
    const tileBounds = this._tileCoordsToNwSe(coords);
    const crs = this._crs;
    const bounds = toBounds(crs.project(tileBounds[0]), crs.project(tileBounds[1]));
    const min = bounds.min;
    const max = bounds.max;
    const bbox = (this._wmsVersion >= 1.3 && this._crs === EPSG4326 ?
        [min.y, min.x, max.y, max.x] :
        [min.x, min.y, max.x, max.y]).join(',');
    const url = TileLayer.prototype.getTileUrl.call(this, coords);
    return url +
        getParamString(this.wmsParams, url, this.options.uppercase) +
        (this.options.uppercase ? '&BBOX=' : '&bbox=') + bbox;
  },

  /**
   * Sets WMS parameters.
   * @param {!Object} params Parameters to set.
   * @param {boolean=} noRedraw Whether to skip redraw.
   * @return {!TileLayerWMS} This layer.
   */
  setParams: function(params, noRedraw) {
    extend(this.wmsParams, params);
    if (!noRedraw) {
      this.redraw();
    }
    return this;
  },
});

/**
 * Creates a WMS tile layer.
 * @param {string} url WMS service URL.
 * @param {Object=} options Layer options.
 * @return {!TileLayerWMS} New WMS layer.
 */
function tileLayerWMS(url, options) {
  return new TileLayerWMS(url, options);
}

// Static property assignment
TileLayer.WMS = TileLayerWMS;
tileLayer.wms = tileLayerWMS;
