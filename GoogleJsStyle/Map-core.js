/**
 * Main map class.
 * @extends {Evented}
 */
const Map = Evented.extend(/** @lends Map.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    crs: EPSG3857,
    center: undefined,
    zoom: undefined,
    minZoom: undefined,
    maxZoom: undefined,
    layers: [],
    maxBounds: undefined,
    renderer: undefined,
    zoomAnimation: true,
    zoomAnimationThreshold: 4,
    fadeAnimation: true,
    markerZoomAnimation: true,
    transform3DLimit: 8388608,
    zoomSnap: 1,
    zoomDelta: 1,
    trackResize: true,
  },

  /**
   * @param {string|Element} id Map container ID or element.
   * @param {Object=} options Map options.
   */
  initialize: function(id, options) {
    options = setOptions(this, options);
    this._handlers = [];
    this._layers = {};
    this._zoomBoundLayers = {};
    this._sizeChanged = true;
    this._initContainer(id);
    this._initLayout();
    this._onResize = bind(this._onResize, this);
    this._initEvents();
    if (options.maxBounds) {
      this.setMaxBounds(options.maxBounds);
    }
    if (options.zoom !== undefined) {
      this._zoom = this._limitZoom(options.zoom);
    }
    if (options.center && options.zoom !== undefined) {
      this.setView(toLatLng(options.center), options.zoom, {reset: true});
    }
    this.callInitHooks();
    this._zoomAnimated = TRANSITION && Browser.any3d && !Browser.mobileOpera &&
        this.options.zoomAnimation;
    if (this._zoomAnimated) {
      this._createAnimProxy();
      on(this._proxy, TRANSITION_END, this._catchTransitionEnd, this);
    }
    this._addLayers(this.options.layers);
  },

  /**
   * Sets the view (center and zoom).
   * @param {!LatLng|number[]} center Center.
   * @param {number=} zoom Zoom level.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  setView: function(center, zoom, options) {
    zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
    center = this._limitCenter(toLatLng(center), zoom, this.options.maxBounds);
    options = options || {};
    this._stop();
    if (this._loaded && !options.reset && options !== true) {
      if (options.animate !== undefined) {
        options.zoom = extend({animate: options.animate}, options.zoom);
        options.pan = extend({animate: options.animate, duration: options.duration}, options.pan);
      }
      const moved = (this._zoom !== zoom) ?
          this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
          this._tryAnimatedPan(center, options.pan);
      if (moved) {
        clearTimeout(this._sizeTimer);
        return this;
      }
    }
    this._resetView(center, zoom, options.pan && options.pan.noMoveStart);
    return this;
  },

  /**
   * Sets the zoom level.
   * @param {number} zoom Zoom level.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  setZoom: function(zoom, options) {
    if (!this._loaded) {
      this._zoom = zoom;
      return this;
    }
    return this.setView(this.getCenter(), zoom, {zoom: options});
  },

  /**
   * Zooms in.
   * @param {number=} delta Zoom delta.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  zoomIn: function(delta, options) {
    delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
    return this.setZoom(this._zoom + delta, options);
  },

  /**
   * Zooms out.
   * @param {number=} delta Zoom delta.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  zoomOut: function(delta, options) {
    delta = delta || (Browser.any3d ? this.options.zoomDelta : 1);
    return this.setZoom(this._zoom - delta, options);
  },

  /**
   * Sets zoom around a point.
   * @param {!LatLng|Point} latlng Center point.
   * @param {number} zoom Zoom level.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  setZoomAround: function(latlng, zoom, options) {
    const scale = this.getZoomScale(zoom);
    const viewHalf = this.getSize().divideBy(2);
    const containerPoint = latlng instanceof Point ? latlng : this.latLngToContainerPoint(latlng);
    const centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale);
    const newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));
    return this.setView(newCenter, zoom, {zoom: options});
  },

  /**
   * Gets center and zoom for bounds.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @param {Object=} options Options.
   * @return {{center: LatLng, zoom: number}} Center and zoom.
   * @private
   */
  _getBoundsCenterZoom: function(bounds, options) {
    options = options || {};
    bounds = bounds.getBounds ? bounds.getBounds() : toLatLngBounds(bounds);
    const paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]);
    const paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]);
    let zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));
    zoom = (typeof options.maxZoom === 'number') ? Math.min(options.maxZoom, zoom) : zoom;
    if (zoom === Infinity) {
      return {
        center: bounds.getCenter(),
        zoom: zoom,
      };
    }
    const paddingOffset = paddingBR.subtract(paddingTL).divideBy(2);
    const swPoint = this.project(bounds.getSouthWest(), zoom);
    const nePoint = this.project(bounds.getNorthEast(), zoom);
    const center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);
    return {
      center: center,
      zoom: zoom,
    };
  },

  /**
   * Fits bounds to view.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  fitBounds: function(bounds, options) {
    bounds = toLatLngBounds(bounds);
    if (!bounds.isValid()) {
      throw new Error('Bounds are not valid.');
    }
    const target = this._getBoundsCenterZoom(bounds, options);
    return this.setView(target.center, target.zoom, options);
  },

  /**
   * Fits world to view.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  fitWorld: function(options) {
    return this.fitBounds([[-90, -180], [90, 180]], options);
  },

  /**
   * Pans to center.
   * @param {!LatLng|number[]} center Center.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  panTo: function(center, options) {
    return this.setView(center, this._zoom, {pan: options});
  },

  /**
   * Pans by offset.
   * @param {!Point|number[]} offset Offset.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  panBy: function(offset, options) {
    offset = toPoint(offset).round();
    options = options || {};
    if (!offset.x && !offset.y) {
      return this.fire('moveend');
    }
    if (options.animate !== true && !this.getSize().contains(offset)) {
      this._resetView(this.unproject(this.project(this.getCenter()).add(offset)), this.getZoom());
      return this;
    }
    if (!this._panAnim) {
      this._panAnim = new PosAnimation();
      this._panAnim.on({
        'step': this._onPanTransitionStep,
        'end': this._onPanTransitionEnd,
      }, this);
    }
    if (!options.noMoveStart) {
      this.fire('movestart');
    }
    if (options.animate !== false) {
      addClass(this._mapPane, 'atlas-pan-anim');
      const newPos = this._getMapPanePos().subtract(offset).round();
      this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
    } else {
      this._rawPanBy(offset);
      this.fire('move').fire('moveend');
    }
    return this;
  },

  /**
   * Flies to target.
   * @param {!LatLng|number[]} targetCenter Target center.
   * @param {number=} targetZoom Target zoom.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  flyTo: function(targetCenter, targetZoom, options) {
    options = options || {};
    if (options.animate === false || !Browser.any3d) {
      return this.setView(targetCenter, targetZoom, options);
    }
    this._stop();
    const from = this.project(this.getCenter());
    const to = this.project(targetCenter);
    const size = this.getSize();
    const startZoom = this._zoom;
    targetCenter = toLatLng(targetCenter);
    targetZoom = targetZoom === undefined ? startZoom : targetZoom;
    const w0 = Math.max(size.x, size.y);
    const w1 = w0 * this.getZoomScale(startZoom, targetZoom);
    const u1 = (to.distanceTo(from)) || 1;
    const rho = 1.42;
    const rho2 = rho * rho;

    /**
     * @param {boolean} i Direction.
     * @return {number} Log value.
     */
    function r(i) {
      const s1 = i ? -1 : 1;
      const s2 = i ? w1 : w0;
      const t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1;
      const b1 = 2 * s2 * rho2 * u1;
      const b = t1 / b1;
      const sq = Math.sqrt(b * b + 1) - b;
      const log = sq < 0.000000001 ? -18 : Math.log(sq);
      return log;
    }

    /**
     * @param {number} n Value.
     * @return {number} Hyperbolic sine.
     */
    function sinh(n) {
      return (Math.exp(n) - Math.exp(-n)) / 2;
    }

    /**
     * @param {number} n Value.
     * @return {number} Hyperbolic cosine.
     */
    function cosh(n) {
      return (Math.exp(n) + Math.exp(-n)) / 2;
    }

    /**
     * @param {number} n Value.
     * @return {number} Hyperbolic tangent.
     */
    function tanh(n) {
      return sinh(n) / cosh(n);
    }

    const r0 = r(0);

    /**
     * @param {number} s Parameter.
     * @return {number} Width.
     */
    function w(s) {
      return w0 * (cosh(r0) / cosh(r0 + rho * s));
    }

    /**
     * @param {number} s Parameter.
     * @return {number} Distance.
     */
    function u(s) {
      return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2;
    }

    /**
     * @param {number} t Time.
     * @return {number} Eased value.
     */
    function easeOut(t) {
      return 1 - Math.pow(1 - t, 1.5);
    }

    const start = Date.now();
    const S = (r(1) - r0) / rho;
    const duration = options.duration ? 1000 * options.duration : 1000 * S * 0.8;

    /**
     * Animation frame function.
     */
    function frame() {
      const t = (Date.now() - start) / duration;
      const s = easeOut(t) * S;
      if (t <= 1) {
        this._flyToFrame = requestAnimFrame(frame, this);
        this._move(
            this.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
            this.getScaleZoom(w0 / w(s), startZoom),
            {flyTo: true});
      } else {
        this
            ._move(targetCenter, targetZoom)
            ._moveEnd(true);
      }
    }

    this._moveStart(true, options.noMoveStart);
    frame.call(this);
    return this;
  },

  /**
   * Flies to bounds.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  flyToBounds: function(bounds, options) {
    const target = this._getBoundsCenterZoom(bounds, options);
    return this.flyTo(target.center, target.zoom, options);
  },

  /**
   * Sets maximum bounds.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @return {!Map} This map.
   */
  setMaxBounds: function(bounds) {
    bounds = toLatLngBounds(bounds);
    if (this.listens('moveend', this._panInsideMaxBounds)) {
      this.off('moveend', this._panInsideMaxBounds);
    }
    if (!bounds.isValid()) {
      this.options.maxBounds = null;
      return this;
    }
    this.options.maxBounds = bounds;
    if (this._loaded) {
      this._panInsideMaxBounds();
    }
    return this.on('moveend', this._panInsideMaxBounds);
  },

  /**
   * Sets minimum zoom.
   * @param {number} zoom Zoom level.
   * @return {!Map} This map.
   */
  setMinZoom: function(zoom) {
    const oldZoom = this.options.minZoom;
    this.options.minZoom = zoom;
    if (this._loaded && oldZoom !== zoom) {
      this.fire('zoomlevelschange');
      if (this.getZoom() < this.options.minZoom) {
        return this.setZoom(zoom);
      }
    }
    return this;
  },

  /**
   * Sets maximum zoom.
   * @param {number} zoom Zoom level.
   * @return {!Map} This map.
   */
  setMaxZoom: function(zoom) {
    const oldZoom = this.options.maxZoom;
    this.options.maxZoom = zoom;
    if (this._loaded && oldZoom !== zoom) {
      this.fire('zoomlevelschange');
      if (this.getZoom() > this.options.maxZoom) {
        return this.setZoom(zoom);
      }
    }
    return this;
  },

  /**
   * Pans inside bounds.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  panInsideBounds: function(bounds, options) {
    this._enforcingBounds = true;
    const center = this.getCenter();
    const newCenter = this._limitCenter(center, this._zoom, toLatLngBounds(bounds));
    if (!center.equals(newCenter)) {
      this.panTo(newCenter, options);
    }
    this._enforcingBounds = false;
    return this;
  },

  /**
   * Pans inside a point with padding.
   * @param {!LatLng|number[]} latlng Point.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  panInside: function(latlng, options) {
    options = options || {};
    const paddingTL = toPoint(options.paddingTopLeft || options.padding || [0, 0]);
    const paddingBR = toPoint(options.paddingBottomRight || options.padding || [0, 0]);
    const pixelCenter = this.project(this.getCenter());
    const pixelPoint = this.project(latlng);
    const pixelBounds = this.getPixelBounds();
    const paddedBounds = toBounds([pixelBounds.min.add(paddingTL), pixelBounds.max.subtract(paddingBR)]);
    const paddedSize = paddedBounds.getSize();
    if (!paddedBounds.contains(pixelPoint)) {
      this._enforcingBounds = true;
      const centerOffset = pixelPoint.subtract(paddedBounds.getCenter());
      const offset = paddedBounds.extend(pixelPoint).getSize().subtract(paddedSize);
      pixelCenter.x += centerOffset.x < 0 ? -offset.x : offset.x;
      pixelCenter.y += centerOffset.y < 0 ? -offset.y : offset.y;
      this.panTo(this.unproject(pixelCenter), options);
      this._enforcingBounds = false;
    }
    return this;
  },

  /**
   * Invalidates size.
   * @param {Object|boolean=} options Options.
   * @return {!Map} This map.
   */
  invalidateSize: function(options) {
    if (!this._loaded) {
      return this;
    }
    options = extend({
      animate: false,
      pan: true,
    }, options === true ? {animate: true} : options);
    const oldSize = this.getSize();
    this._sizeChanged = true;
    this._lastCenter = null;
    const newSize = this.getSize();
    const oldCenter = oldSize.divideBy(2).round();
    const newCenter = newSize.divideBy(2).round();
    const offset = oldCenter.subtract(newCenter);
    if (!offset.x && !offset.y) {
      return this;
    }
    if (options.animate && options.pan) {
      this.panBy(offset);
    } else {
      if (options.pan) {
        this._rawPanBy(offset);
      }
      this.fire('move');
      if (options.debounceMoveend) {
        clearTimeout(this._sizeTimer);
        this._sizeTimer = setTimeout(bind(this.fire, this, 'moveend'), 200);
      } else {
        this.fire('moveend');
      }
    }
    return this.fire('resize', {
      oldSize: oldSize,
      newSize: newSize,
    });
  },

  /**
   * Stops current animation.
   * @return {!Map} This map.
   */
  stop: function() {
    this.setZoom(this._limitZoom(this._zoom));
    if (!this.options.zoomSnap) {
      this.fire('viewreset');
    }
    return this._stop();
  },

  /**
   * Locates user position.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  locate: function(options) {
    options = this._locateOptions = extend({
      timeout: 10000,
      watch: false,
    }, options);
    if (!('geolocation' in navigator)) {
      this._handleGeolocationError({
        code: 0,
        message: 'Geolocation not supported.',
      });
      return this;
    }
    const onResponse = bind(this._handleGeolocationResponse, this);
    const onError = bind(this._handleGeolocationError, this);
    if (options.watch) {
      this._locationWatchId =
          navigator.geolocation.watchPosition(onResponse, onError, options);
    } else {
      navigator.geolocation.getCurrentPosition(onResponse, onError, options);
    }
    return this;
  },

  /**
   * Stops locating.
   * @return {!Map} This map.
   */
  stopLocate: function() {
    if (navigator.geolocation && navigator.geolocation.clearWatch) {
      navigator.geolocation.clearWatch(this._locationWatchId);
    }
    if (this._locateOptions) {
      this._locateOptions.setView = false;
    }
    return this;
  },

  /**
   * Handles geolocation error.
   * @param {!Object} error Error object.
   * @private
   */
  _handleGeolocationError: function(error) {
    if (!this._container._atlas_id) {
      return;
    }
    const c = error.code;
    const message = error.message ||
        (c === 1 ? 'permission denied' :
        (c === 2 ? 'position unavailable' : 'timeout'));
    if (this._locateOptions.setView && !this._loaded) {
      this.fitWorld();
    }
    this.fire('locationerror', {
      code: c,
      message: 'Geolocation error: ' + message + '.',
    });
  },

  /**
   * Handles geolocation response.
   * @param {!Object} pos Position object.
   * @private
   */
  _handleGeolocationResponse: function(pos) {
    if (!this._container._atlas_id) {
      return;
    }
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const latlng = new LatLng(lat, lng);
    const bounds = latlng.toBounds(pos.coords.accuracy * 2);
    const options = this._locateOptions;
    if (options.setView) {
      const zoom = this.getBoundsZoom(bounds);
      this.setView(latlng, options.maxZoom ? Math.min(zoom, options.maxZoom) : zoom);
    }
    const data = {
      latlng: latlng,
      bounds: bounds,
      timestamp: pos.timestamp,
    };
    for (const i in pos.coords) {
      if (typeof pos.coords[i] === 'number') {
        data[i] = pos.coords[i];
      }
    }
    this.fire('locationfound', data);
  },

  /**
   * Adds a handler.
   * @param {string} name Handler name.
   * @param {Function} HandlerClass Handler class.
   * @return {!Map} This map.
   */
  addHandler: function(name, HandlerClass) {
    if (!HandlerClass) {
      return this;
    }
    const handler = this[name] = new HandlerClass(this);
    this._handlers.push(handler);
    if (this.options[name]) {
      handler.enable();
    }
    return this;
  },

  /**
   * Removes map from DOM.
   * @return {!Map} This map.
   */
  remove: function() {
    this._initEvents(true);
    if (this.options.maxBounds) {
      this.off('moveend', this._panInsideMaxBounds);
    }
    if (this._containerId !== this._container._atlas_id) {
      throw new Error('Map container is being reused by another instance');
    }
    try {
      delete this._container._atlas_id;
      delete this._containerId;
    } catch (e) {
      this._container._atlas_id = undefined;
      this._containerId = undefined;
    }
    if (this._locationWatchId !== undefined) {
      this.stopLocate();
    }
    this._stop();
    remove(this._mapPane);
    if (this._clearControlPos) {
      this._clearControlPos();
    }
    if (this._resizeRequest) {
      cancelAnimFrame(this._resizeRequest);
      this._resizeRequest = null;
    }
    this._clearHandlers();
    if (this._loaded) {
      this.fire('unload');
    }
    let i;
    for (i in this._layers) {
      this._layers[i].remove();
    }
    for (i in this._panes) {
      remove(this._panes[i]);
    }
    this._layers = [];
    this._panes = [];
    delete this._mapPane;
    delete this._renderer;
    return this;
  },

  /**
   * Creates a pane.
   * @param {string} name Pane name.
   * @param {Element=} container Container.
   * @return {!Element} Created pane.
   */
  createPane: function(name, container) {
    const className = 'atlas-pane' + (name ? ' atlas-' + name.replace('Pane', '') + '-pane' : '');
    const pane = create$1('div', className, container || this._mapPane);
    if (name) {
      this._panes[name] = pane;
    }
    return pane;
  },

  /**
   * Gets map center.
   * @return {!LatLng} Center.
   */
  getCenter: function() {
    this._checkIfLoaded();
    if (this._lastCenter && !this._moved()) {
      return this._lastCenter.clone();
    }
    return this.layerPointToLatLng(this._getCenterLayerPoint());
  },

  /**
   * Gets current zoom.
   * @return {number} Zoom level.
   */
  getZoom: function() {
    return this._zoom;
  },

  /**
   * Gets current bounds.
   * @return {!LatLngBounds} Bounds.
   */
  getBounds: function() {
    const bounds = this.getPixelBounds();
    const sw = this.unproject(bounds.getBottomLeft());
    const ne = this.unproject(bounds.getTopRight());
    return new LatLngBounds(sw, ne);
  },

  /**
   * Gets minimum zoom.
   * @return {number} Minimum zoom.
   */
  getMinZoom: function() {
    return this.options.minZoom === undefined ? this._layersMinZoom || 0 : this.options.minZoom;
  },

  /**
   * Gets maximum zoom.
   * @return {number} Maximum zoom.
   */
  getMaxZoom: function() {
    return this.options.maxZoom === undefined ?
        (this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
        this.options.maxZoom;
  },

  /**
   * Gets bounds zoom.
   * @param {!LatLngBounds|LatLng[]} bounds Bounds.
   * @param {boolean=} inside Whether to fit inside.
   * @param {Point|number[]=} padding Padding.
   * @return {number} Zoom level.
   */
  getBoundsZoom: function(bounds, inside, padding) {
    bounds = toLatLngBounds(bounds);
    padding = toPoint(padding || [0, 0]);
    let zoom = this.getZoom() || 0;
    const min = this.getMinZoom();
    const max = this.getMaxZoom();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const size = this.getSize().subtract(padding);
    const boundsSize = toBounds(this.project(se, zoom), this.project(nw, zoom)).getSize();
    const snap = Browser.any3d ? this.options.zoomSnap : 1;
    const scalex = size.x / boundsSize.x;
    const scaley = size.y / boundsSize.y;
    const scale = inside ? Math.max(scalex, scaley) : Math.min(scalex, scaley);
    zoom = this.getScaleZoom(scale, zoom);
    if (snap) {
      zoom = Math.round(zoom / (snap / 100)) * (snap / 100);
      zoom = inside ? Math.ceil(zoom / snap) * snap : Math.floor(zoom / snap) * snap;
    }
    return Math.max(min, Math.min(max, zoom));
  },

  /**
   * Gets map size.
   * @return {!Point} Size.
   */
  getSize: function() {
    if (!this._size || this._sizeChanged) {
      this._size = new Point(
          this._container.clientWidth || 0,
          this._container.clientHeight || 0);
      this._sizeChanged = false;
    }
    return this._size.clone();
  },

  /**
   * Gets pixel bounds.
   * @param {!LatLng|number[]=} center Center.
   * @param {number=} zoom Zoom.
   * @return {!Bounds} Pixel bounds.
   */
  getPixelBounds: function(center, zoom) {
    const topLeftPoint = this._getTopLeftPoint(center, zoom);
    return new Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
  },

  /**
   * Gets pixel origin.
   * @return {!Point} Pixel origin.
   */
  getPixelOrigin: function() {
    this._checkIfLoaded();
    return this._pixelOrigin;
  },

  /**
   * Gets pixel world bounds.
   * @param {number=} zoom Zoom level.
   * @return {Bounds|undefined} World bounds.
   */
  getPixelWorldBounds: function(zoom) {
    return this.options.crs.getProjectedBounds(zoom === undefined ? this.getZoom() : zoom);
  },

  /**
   * Gets a pane.
   * @param {string|Element} pane Pane name or element.
   * @return {Element} Pane element.
   */
  getPane: function(pane) {
    return typeof pane === 'string' ? this._panes[pane] : pane;
  },

  /**
   * Gets all panes.
   * @return {!Object} Panes object.
   */
  getPanes: function() {
    return this._panes;
  },

  /**
   * Gets container element.
   * @return {!Element} Container.
   */
  getContainer: function() {
    return this._container;
  },

  /**
   * Gets zoom scale.
   * @param {number} toZoom Target zoom.
   * @param {number=} fromZoom Source zoom.
   * @return {number} Scale.
   */
  getZoomScale: function(toZoom, fromZoom) {
    const crs = this.options.crs;
    fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
    return crs.scale(toZoom) / crs.scale(fromZoom);
  },

  /**
   * Gets scale zoom.
   * @param {number} scale Scale.
   * @param {number=} fromZoom Source zoom.
   * @return {number} Zoom level.
   */
  getScaleZoom: function(scale, fromZoom) {
    const crs = this.options.crs;
    fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
    const zoom = crs.zoom(scale * crs.scale(fromZoom));
    return isNaN(zoom) ? Infinity : zoom;
  },

  /**
   * Projects LatLng to Point.
   * @param {!LatLng|number[]} latlng LatLng.
   * @param {number=} zoom Zoom level.
   * @return {!Point} Projected point.
   */
  project: function(latlng, zoom) {
    zoom = zoom === undefined ? this._zoom : zoom;
    return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
  },

  /**
   * Unprojects Point to LatLng.
   * @param {!Point|number[]} point Point.
   * @param {number=} zoom Zoom level.
   * @return {!LatLng} Unprojected LatLng.
   */
  unproject: function(point, zoom) {
    zoom = zoom === undefined ? this._zoom : zoom;
    return this.options.crs.pointToLatLng(toPoint(point), zoom);
  },

  /**
   * Converts layer point to LatLng.
   * @param {!Point|number[]} point Layer point.
   * @return {!LatLng} LatLng.
   */
  layerPointToLatLng: function(point) {
    const projectedPoint = toPoint(point).add(this.getPixelOrigin());
    return this.unproject(projectedPoint);
  },

  /**
   * Converts LatLng to layer point.
   * @param {!LatLng|number[]} latlng LatLng.
   * @return {!Point} Layer point.
   */
  latLngToLayerPoint: function(latlng) {
    const projectedPoint = this.project(toLatLng(latlng))._round();
    return projectedPoint._subtract(this.getPixelOrigin());
  },

  /**
   * Wraps LatLng.
   * @param {!LatLng|number[]} latlng LatLng.
   * @return {!LatLng} Wrapped LatLng.
   */
  wrapLatLng: function(latlng) {
    return this.options.crs.wrapLatLng(toLatLng(latlng));
  },

  /**
   * Wraps LatLng bounds.
   * @param {!LatLngBounds|LatLng[]} latlng Bounds.
   * @return {!LatLngBounds} Wrapped bounds.
   */
  wrapLatLngBounds: function(latlng) {
    return this.options.crs.wrapLatLngBounds(toLatLngBounds(latlng));
  },

  /**
   * Calculates distance.
   * @param {!LatLng|number[]} latlng1 First point.
   * @param {!LatLng|number[]} latlng2 Second point.
   * @return {number} Distance in meters.
   */
  distance: function(latlng1, latlng2) {
    return this.options.crs.distance(toLatLng(latlng1), toLatLng(latlng2));
  },

  /**
   * Converts container point to layer point.
   * @param {!Point|number[]} point Container point.
   * @return {!Point} Layer point.
   */
  containerPointToLayerPoint: function(point) {
    return toPoint(point).subtract(this._getMapPanePos());
  },

  /**
   * Converts layer point to container point.
   * @param {!Point|number[]} point Layer point.
   * @return {!Point} Container point.
   */
  layerPointToContainerPoint: function(point) {
    return toPoint(point).add(this._getMapPanePos());
  },

  /**
   * Converts mouse event to container point.
   * @param {Event} e Mouse event.
   * @return {!Point} Container point.
   */
  mouseEventToContainerPoint: function(e) {
    return getMousePosition(e, this._container);
  },

  /**
   * Converts mouse event to layer point.
   * @param {Event} e Mouse event.
   * @return {!Point} Layer point.
   */
  mouseEventToLayerPoint: function(e) {
    return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
  },

  /**
   * Converts mouse event to LatLng.
   * @param {Event} e Mouse event.
   * @return {!LatLng} LatLng.
   */
  mouseEventToLatLng: function(e) {
    return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
  },

  /**
   * Initializes container.
   * @param {string|Element} id Container ID or element.
   * @private
   */
  _initContainer: function(id) {
    const container = this._container = get(id);
    if (!container) {
      throw new Error('Map container not found.');
    } else if (container._atlas_id) {
      throw new Error('Map container is already initialized.');
    }
    on(container, 'scroll', this._onScroll, this);
    this._containerId = stamp(container);
  },

  /**
   * Initializes layout.
   * @private
   */
  _initLayout: function() {
    const container = this._container;
    this._fadeAnimated = this.options.fadeAnimation && Browser.any3d;
    addClass(container, 'atlas-container' +
        (Browser.touch ? ' atlas-touch' : '') +
        (Browser.retina ? ' atlas-retina' : '') +
        (Browser.safari ? ' atlas-safari' : '') +
        (this._fadeAnimated ? ' atlas-fade-anim' : ''));
    const position = getStyle(container, 'position');
    if (position !== 'absolute' && position !== 'relative' && position !== 'fixed' && position !== 'sticky') {
      container.style.position = 'relative';
    }
    this._initPanes();
    if (this._initControlPos) {
      this._initControlPos();
    }
  },

  /**
   * Initializes panes.
   * @private
   */
  _initPanes: function() {
    const panes = this._panes = {};
    this._paneRenderers = {};
    this._mapPane = this.createPane('mapPane', this._container);
    setPosition(this._mapPane, new Point(0, 0));
    this.createPane('tilePane');
    this.createPane('overlayPane');
    this.createPane('shadowPane');
    this.createPane('markerPane');
    this.createPane('tooltipPane');
    this.createPane('popupPane');
    if (!this.options.markerZoomAnimation) {
      addClass(panes.markerPane, 'atlas-zoom-hide');
      addClass(panes.shadowPane, 'atlas-zoom-hide');
    }
  },

  /**
   * Resets view.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @param {boolean=} noMoveStart Whether to skip movestart.
   * @private
   */
  _resetView: function(center, zoom, noMoveStart) {
    setPosition(this._mapPane, new Point(0, 0));
    const loading = !this._loaded;
    this._loaded = true;
    zoom = this._limitZoom(zoom);
    this.fire('viewprereset');
    const zoomChanged = this._zoom !== zoom;
    this
        ._moveStart(zoomChanged, noMoveStart)
        ._move(center, zoom)
        ._moveEnd(zoomChanged);
    this.fire('viewreset');
    if (loading) {
      this.fire('load');
    }
  },

  /**
   * Starts move.
   * @param {boolean} zoomChanged Whether zoom changed.
   * @param {boolean=} noMoveStart Whether to skip movestart.
   * @return {!Map} This map.
   * @private
   */
  _moveStart: function(zoomChanged, noMoveStart) {
    if (zoomChanged) {
      this.fire('zoomstart');
    }
    if (!noMoveStart) {
      this.fire('movestart');
    }
    return this;
  },

  /**
   * Moves map.
   * @param {!LatLng|number[]} center Center.
   * @param {number=} zoom Zoom level.
   * @param {Object=} data Event data.
   * @param {boolean=} supressEvent Whether to suppress events.
   * @return {!Map} This map.
   * @private
   */
  _move: function(center, zoom, data, supressEvent) {
    if (zoom === undefined) {
      zoom = this._zoom;
    }
    const zoomChanged = this._zoom !== zoom;
    this._zoom = zoom;
    this._lastCenter = center;
    this._pixelOrigin = this._getNewPixelOrigin(center);
    if (!supressEvent) {
      if (zoomChanged || (data && data.pinch)) {
        this.fire('zoom', data);
      }
      this.fire('move', data);
    } else if (data && data.pinch) {
      this.fire('zoom', data);
    }
    return this;
  },

  /**
   * Ends move.
   * @param {boolean} zoomChanged Whether zoom changed.
   * @return {!Map} This map.
   * @private
   */
  _moveEnd: function(zoomChanged) {
    if (zoomChanged) {
      this.fire('zoomend');
    }
    return this.fire('moveend');
  },

  /**
   * Stops animations.
   * @return {!Map} This map.
   * @private
   */
  _stop: function() {
    cancelAnimFrame(this._flyToFrame);
    if (this._panAnim) {
      this._panAnim.stop();
    }
    return this;
  },

  /**
   * Pans by raw offset.
   * @param {!Point} offset Offset.
   * @private
   */
  _rawPanBy: function(offset) {
    setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
  },

  /**
   * Gets zoom span.
   * @return {number} Zoom span.
   * @private
   */
  _getZoomSpan: function() {
    return this.getMaxZoom() - this.getMinZoom();
  },

  /**
   * Pans inside max bounds.
   * @private
   */
  _panInsideMaxBounds: function() {
    if (!this._enforcingBounds) {
      this.panInsideBounds(this.options.maxBounds);
    }
  },

  /**
   * Checks if map is loaded.
   * @private
   */
  _checkIfLoaded: function() {
    if (!this._loaded) {
      throw new Error('Set map center and zoom first.');
    }
  },

  /**
   * Initializes events.
   * @param {boolean=} remove Whether to remove events.
   * @private
   */
  _initEvents: function(remove) {
    this._targets = {};
    this._targets[stamp(this._container)] = this;
    const onOff = remove ? off : on;
    onOff(this._container, 'click dblclick mousedown mouseup ' +
        'mouseover mouseout mousemove contextmenu keypress keydown keyup', this._handleDOMEvent, this);
    if (this.options.trackResize) {
      onOff(window, 'resize', this._onResize, this);
    }
    if (Browser.any3d && this.options.transform3DLimit) {
      (remove ? this.off : this.on).call(this, 'moveend', this._onMoveEnd);
    }
  },

  /**
   * Handles resize.
   * @private
   */
  _onResize: function() {
    cancelAnimFrame(this._resizeRequest);
    this._resizeRequest = requestAnimFrame(
        function() {
          this.invalidateSize({debounceMoveend: true});
        }, this);
  },

  /**
   * Handles scroll.
   * @private
   */
  _onScroll: function() {
    this._container.scrollTop = 0;
    this._container.scrollLeft = 0;
  },

  /**
   * Handles move end for transform limit.
   * @private
   */
  _onMoveEnd: function() {
    const pos = this._getMapPanePos();
    if (Math.max(Math.abs(pos.x), Math.abs(pos.y)) >= this.options.transform3DLimit) {
      this._resetView(this.getCenter(), this.getZoom());
    }
  },

  /**
   * Finds event targets.
   * @param {Event} e Event.
   * @param {string} type Event type.
   * @return {Array} Target layers.
   * @private
   */
  _findEventTargets: function(e, type) {
    const targets = [];
    let target;
    const isHover = type === 'mouseout' || type === 'mouseover';
    let src = e.target || e.srcElement;
    let dragging = false;
    while (src) {
      target = this._targets[stamp(src)];
      if (target && (type === 'click' || type === 'preclick') && this._draggableMoved(target)) {
        dragging = true;
        break;
      }
      if (target && target.listens(type, true)) {
        if (isHover && !isExternalTarget(src, e)) {
          break;
        }
        targets.push(target);
        if (isHover) {
          break;
        }
      }
      if (src === this._container) {
        break;
      }
      src = src.parentNode;
    }
    if (!targets.length && !dragging && !isHover && this.listens(type, true)) {
      targets = [this];
    }
    return targets;
  },

  /**
   * Checks if click is disabled.
   * @param {Element} el Element.
   * @return {boolean} Whether disabled.
   * @private
   */
  _isClickDisabled: function(el) {
    while (el && el !== this._container) {
      if (el['_atlas_disable_click']) {
        return true;
      }
      el = el.parentNode;
    }
  },

  /**
   * Handles DOM events.
   * @param {Event} e Event.
   * @private
   */
  _handleDOMEvent: function(e) {
    const el = (e.target || e.srcElement);
    if (!this._loaded || el['_atlas_disable_events'] || e.type === 'click' && this._isClickDisabled(el)) {
      return;
    }
    const type = e.type;
    if (type === 'mousedown') {
      preventOutline(el);
    }
    this._fireDOMEvent(e, type);
  },

  /** @type {Array<string>} Mouse events. */
  _mouseEvents: ['click', 'dblclick', 'mouseover', 'mouseout', 'contextmenu'],

  /**
   * Fires DOM event.
   * @param {Event} e Event.
   * @param {string} type Event type.
   * @param {Array=} canvasTargets Canvas targets.
   * @private
   */
  _fireDOMEvent: function(e, type, canvasTargets) {
    if (e.type === 'click') {
      const synth = extend({}, e);
      synth.type = 'preclick';
      this._fireDOMEvent(synth, synth.type, canvasTargets);
    }
    let targets = this._findEventTargets(e, type);
    if (canvasTargets) {
      const filtered = [];
      for (let i = 0; i < canvasTargets.length; i++) {
        if (canvasTargets[i].listens(type, true)) {
          filtered.push(canvasTargets[i]);
        }
      }
      targets = filtered.concat(targets);
    }
    if (!targets.length) {
      return;
    }
    if (type === 'contextmenu') {
      preventDefault(e);
    }
    const target = targets[0];
    const data = {
      originalEvent: e,
    };
    if (e.type !== 'keypress' && e.type !== 'keydown' && e.type !== 'keyup') {
      const isMarker = target.getLatLng && (!target._radius || target._radius <= 10);
      data.containerPoint = isMarker ?
          this.latLngToContainerPoint(target.getLatLng()) : this.mouseEventToContainerPoint(e);
      data.layerPoint = this.containerPointToLayerPoint(data.containerPoint);
      data.latlng = isMarker ? target.getLatLng() : this.layerPointToLatLng(data.layerPoint);
    }
    for (let i = 0; i < targets.length; i++) {
      targets[i].fire(type, data, true);
      if (data.originalEvent._stopped ||
          (targets[i].options.bubblingMouseEvents === false && indexOf(this._mouseEvents, type) !== -1)) {
        return;
      }
    }
  },

  /**
   * Checks if draggable moved.
   * @param {Object} obj Object.
   * @return {boolean} Whether moved.
   * @private
   */
  _draggableMoved: function(obj) {
    obj = obj.dragging && obj.dragging.enabled() ? obj : this;
    return (obj.dragging && obj.dragging.moved()) || (this.boxZoom && this.boxZoom.moved());
  },

  /**
   * Clears handlers.
   * @private
   */
  _clearHandlers: function() {
    for (let i = 0, len = this._handlers.length; i < len; i++) {
      this._handlers[i].disable();
    }
  },

  /**
   * Calls callback when ready.
   * @param {Function} callback Callback.
   * @param {Object=} context Context.
   * @return {!Map} This map.
   */
  whenReady: function(callback, context) {
    if (this._loaded) {
      callback.call(context || this, {target: this});
    } else {
      this.on('load', callback, context);
    }
    return this;
  },

  /**
   * Gets map pane position.
   * @return {!Point} Position.
   * @private
   */
  _getMapPanePos: function() {
    return getPosition(this._mapPane) || new Point(0, 0);
  },

  /**
   * Checks if map moved.
   * @return {boolean} Whether moved.
   * @private
   */
  _moved: function() {
    const pos = this._getMapPanePos();
    return pos && !pos.equals([0, 0]);
  },

  /**
   * Gets top-left point.
   * @param {!LatLng|number[]=} center Center.
   * @param {number=} zoom Zoom level.
   * @return {!Point} Top-left point.
   * @private
   */
  _getTopLeftPoint: function(center, zoom) {
    const pixelOrigin = center && zoom !== undefined ?
        this._getNewPixelOrigin(center, zoom) :
        this.getPixelOrigin();
    return pixelOrigin.subtract(this._getMapPanePos());
  },

  /**
   * Gets new pixel origin.
   * @param {!LatLng|number[]} center Center.
   * @param {number=} zoom Zoom level.
   * @return {!Point} Pixel origin.
   * @private
   */
  _getNewPixelOrigin: function(center, zoom) {
    const viewHalf = this.getSize()._divideBy(2);
    return this.project(center, zoom)._subtract(viewHalf)._add(this._getMapPanePos())._round();
  },

  /**
   * Converts LatLng to new layer point.
   * @param {!LatLng|number[]} latlng LatLng.
   * @param {number} zoom Zoom level.
   * @param {!LatLng|number[]} center Center.
   * @return {!Point} Layer point.
   * @private
   */
  _latLngToNewLayerPoint: function(latlng, zoom, center) {
    const topLeft = this._getNewPixelOrigin(center, zoom);
    return this.project(latlng, zoom)._subtract(topLeft);
  },

  /**
   * Converts LatLng bounds to new layer bounds.
   * @param {!LatLngBounds} latLngBounds Bounds.
   * @param {number} zoom Zoom level.
   * @param {!LatLng|number[]} center Center.
   * @return {!Bounds} Layer bounds.
   * @private
   */
  _latLngBoundsToNewLayerBounds: function(latLngBounds, zoom, center) {
    const topLeft = this._getNewPixelOrigin(center, zoom);
    return toBounds([
      this.project(latLngBounds.getSouthWest(), zoom)._subtract(topLeft),
      this.project(latLngBounds.getNorthWest(), zoom)._subtract(topLeft),
      this.project(latLngBounds.getSouthEast(), zoom)._subtract(topLeft),
      this.project(latLngBounds.getNorthEast(), zoom)._subtract(topLeft),
    ]);
  },

  /**
   * Gets center layer point.
   * @return {!Point} Center point.
   * @private
   */
  _getCenterLayerPoint: function() {
    return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
  },

  /**
   * Gets center offset.
   * @param {!LatLng|number[]} latlng LatLng.
   * @return {!Point} Offset.
   * @private
   */
  _getCenterOffset: function(latlng) {
    return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
  },

  /**
   * Limits center to bounds.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @param {!LatLngBounds|LatLng[]=} bounds Bounds.
   * @return {!LatLng} Limited center.
   * @private
   */
  _limitCenter: function(center, zoom, bounds) {
    if (!bounds) {
      return center;
    }
    const centerPoint = this.project(center, zoom);
    const viewHalf = this.getSize().divideBy(2);
    const viewBounds = new Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf));
    const offset = this._getBoundsOffset(viewBounds, bounds, zoom);
    if (Math.abs(offset.x) <= 1 && Math.abs(offset.y) <= 1) {
      return center;
    }
    return this.unproject(centerPoint.add(offset), zoom);
  },

  /**
   * Limits offset to bounds.
   * @param {!Point} offset Offset.
   * @param {!LatLngBounds|LatLng[]=} bounds Bounds.
   * @return {!Point} Limited offset.
   * @private
   */
  _limitOffset: function(offset, bounds) {
    if (!bounds) {
      return offset;
    }
    const viewBounds = this.getPixelBounds();
    const newBounds = new Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));
    return offset.add(this._getBoundsOffset(newBounds, bounds));
  },

  /**
   * Gets bounds offset.
   * @param {!Bounds} pxBounds Pixel bounds.
   * @param {!LatLngBounds|LatLng[]} maxBounds Maximum bounds.
   * @param {number} zoom Zoom level.
   * @return {!Point} Offset.
   * @private
   */
  _getBoundsOffset: function(pxBounds, maxBounds, zoom) {
    const projectedMaxBounds = toBounds(
        this.project(maxBounds.getNorthEast(), zoom),
        this.project(maxBounds.getSouthWest(), zoom));
    const minOffset = projectedMaxBounds.min.subtract(pxBounds.min);
    const maxOffset = projectedMaxBounds.max.subtract(pxBounds.max);
    const dx = this._rebound(minOffset.x, -maxOffset.x);
    const dy = this._rebound(minOffset.y, -maxOffset.y);
    return new Point(dx, dy);
  },

  /**
   * Rebounds offset.
   * @param {number} left Left offset.
   * @param {number} right Right offset.
   * @return {number} Rebounded offset.
   * @private
   */
  _rebound: function(left, right) {
    return left + right > 0 ?
        Math.round(left - right) / 2 :
        Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
  },

  /**
   * Limits zoom level.
   * @param {number} zoom Zoom level.
   * @return {number} Limited zoom.
   * @private
   */
  _limitZoom: function(zoom) {
    const min = this.getMinZoom();
    const max = this.getMaxZoom();
    const snap = Browser.any3d ? this.options.zoomSnap : 1;
    if (snap) {
      zoom = Math.round(zoom / snap) * snap;
    }
    return Math.max(min, Math.min(max, zoom));
  },

  /**
   * Handles pan transition step.
   * @private
   */
  _onPanTransitionStep: function() {
    this.fire('move');
  },

  /**
   * Handles pan transition end.
   * @private
   */
  _onPanTransitionEnd: function() {
    removeClass(this._mapPane, 'atlas-pan-anim');
    this.fire('moveend');
  },

  /**
   * Tries animated pan.
   * @param {!LatLng|number[]} center Center.
   * @param {Object=} options Options.
   * @return {boolean} Whether animated.
   * @private
   */
  _tryAnimatedPan: function(center, options) {
    const offset = this._getCenterOffset(center)._trunc();
    if ((options && options.animate) !== true && !this.getSize().contains(offset)) {
      return false;
    }
    this.panBy(offset, options);
    return true;
  },

  /**
   * Creates animation proxy.
   * @private
   */
  _createAnimProxy: function() {
    const proxy = this._proxy = create$1('div', 'atlas-proxy atlas-zoom-animated');
    this._panes.mapPane.appendChild(proxy);
    this.on('zoomanim', function(e) {
      const prop = TRANSFORM;
      const transform = this._proxy.style[prop];
      setTransform(this._proxy, this.project(e.center, e.zoom), this.getZoomScale(e.zoom, 1));
      if (transform === this._proxy.style[prop] && this._animatingZoom) {
        this._onZoomTransitionEnd();
      }
    }, this);
    this.on('load moveend', this._animMoveEnd, this);
    this._on('unload', this._destroyAnimProxy, this);
  },

  /**
   * Destroys animation proxy.
   * @private
   */
  _destroyAnimProxy: function() {
    remove(this._proxy);
    this.off('load moveend', this._animMoveEnd, this);
    delete this._proxy;
  },

  /**
   * Animates move end.
   * @private
   */
  _animMoveEnd: function() {
    const c = this.getCenter();
    const z = this.getZoom();
    setTransform(this._proxy, this.project(c, z), this.getZoomScale(z, 1));
  },

  /**
   * Catches transition end.
   * @param {Event} e Event.
   * @private
   */
  _catchTransitionEnd: function(e) {
    if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
      this._onZoomTransitionEnd();
    }
  },

  /**
   * Checks if nothing to animate.
   * @return {boolean} Whether nothing to animate.
   * @private
   */
  _nothingToAnimate: function() {
    return !this._container.getElementsByClassName('atlas-zoom-animated').length;
  },

  /**
   * Tries animated zoom.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @param {Object=} options Options.
   * @return {boolean} Whether animated.
   * @private
   */
  _tryAnimatedZoom: function(center, zoom, options) {
    if (this._animatingZoom) {
      return true;
    }
    options = options || {};
    if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) {
      return false;
    }
    const scale = this.getZoomScale(zoom);
    const offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale);
    if (options.animate !== true && !this.getSize().contains(offset)) {
      return false;
    }
    requestAnimFrame(function() {
      this
          ._moveStart(true, options.noMoveStart || false)
          ._animateZoom(center, zoom, true);
    }, this);
    return true;
  },

  /**
   * Animates zoom.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @param {boolean} startAnim Whether to start animation.
   * @param {boolean=} noUpdate Whether to skip update.
   * @private
   */
  _animateZoom: function(center, zoom, startAnim, noUpdate) {
    if (!this._mapPane) {
      return;
    }
    if (startAnim) {
      this._animatingZoom = true;
      this._animateToCenter = center;
      this._animateToZoom = zoom;
      addClass(this._mapPane, 'atlas-zoom-anim');
    }
    this.fire('zoomanim', {
      center: center,
      zoom: zoom,
      noUpdate: noUpdate,
    });
    if (!this._tempFireZoomEvent) {
      this._tempFireZoomEvent = this._zoom !== this._animateToZoom;
    }
    this._move(this._animateToCenter, this._animateToZoom, undefined, true);
    setTimeout(bind(this._onZoomTransitionEnd, this), 250);
  },

  /**
   * Handles zoom transition end.
   * @private
   */
  _onZoomTransitionEnd: function() {
    if (!this._animatingZoom) {
      return;
    }
    if (this._mapPane) {
      removeClass(this._mapPane, 'atlas-zoom-anim');
    }
    this._animatingZoom = false;
    this._move(this._animateToCenter, this._animateToZoom, undefined, true);
    if (this._tempFireZoomEvent) {
      this.fire('zoom');
    }
    delete this._tempFireZoomEvent;
    this.fire('move');
    this._moveEnd(true);
  },
});

/**
 * Creates a map instance.
 * @param {string|Element} id Container ID or element.
 * @param {Object=} options Map options.
 * @return {!Map} New map instance.
 */
function createMap(id, options) {
  return new Map(id, options);
}
