/**
 * Base renderer class for vector layers.
 * @extends {Layer}
 */
const Renderer = Layer.extend(/** @lends Renderer.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    padding: 0.1,
  },

  /**
   * @param {Object=} options Renderer options.
   */
  initialize: function(options) {
    setOptions(this, options);
    stamp(this);
    this._layers = this._layers || {};
  },

  /**
   * Called when added to map.
   */
  onAdd: function() {
    if (!this._container) {
      this._initContainer();
      addClass(this._container, 'atlas-zoom-animated');
    }
    this.getPane().appendChild(this._container);
    this._update();
    this.on('update', this._updatePaths, this);
  },

  /**
   * Called when removed from map.
   */
  onRemove: function() {
    this.off('update', this._updatePaths, this);
    this._destroyContainer();
  },

  /**
   * Gets events handled by renderer.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = {
      viewreset: this._reset,
      zoom: this._onZoom,
      moveend: this._update,
      zoomend: this._onZoomEnd,
    };
    if (this._zoomAnimated) {
      events.zoomanim = this._onAnimZoom;
    }
    return events;
  },

  /**
   * Handles zoom animation.
   * @param {!Object} ev Zoom event.
   * @private
   */
  _onAnimZoom: function(ev) {
    this._updateTransform(ev.center, ev.zoom);
  },

  /**
   * Handles zoom start.
   * @private
   */
  _onZoom: function() {
    this._updateTransform(this._map.getCenter(), this._map.getZoom());
  },

  /**
   * Updates container transform.
   * @param {!LatLng|number[]} center Center.
   * @param {number} zoom Zoom level.
   * @private
   */
  _updateTransform: function(center, zoom) {
    const scale = this._map.getZoomScale(zoom, this._zoom);
    const viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding);
    const currentCenterPoint = this._map.project(this._center, zoom);
    const topLeftOffset = viewHalf.multiplyBy(-scale).add(currentCenterPoint)
        .subtract(this._map._getNewPixelOrigin(center, zoom));
    if (Browser.any3d) {
      setTransform(this._container, topLeftOffset, scale);
    } else {
      setPosition(this._container, topLeftOffset);
    }
  },

  /**
   * Resets renderer state.
   * @private
   */
  _reset: function() {
    this._update();
    this._updateTransform(this._center, this._zoom);
    for (const id in this._layers) {
      this._layers[id]._reset();
    }
  },

  /**
   * Handles zoom end.
   * @private
   */
  _onZoomEnd: function() {
    for (const id in this._layers) {
      this._layers[id]._project();
    }
  },

  /**
   * Updates all paths.
   * @private
   */
  _updatePaths: function() {
    for (const id in this._layers) {
      this._layers[id]._update();
    }
  },

  /**
   * Updates renderer bounds.
   * @private
   */
  _update: function() {
    const p = this.options.padding;
    const size = this._map.getSize();
    const min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();
    this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
    this._center = this._map.getCenter();
    this._zoom = this._map.getZoom();
  },
});

/**
 * Canvas renderer.
 * @extends {Renderer}
 */
const Canvas = Renderer.extend(/** @lends Canvas.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    tolerance: 0,
  },

  /**
   * Gets events handled by renderer.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = Renderer.prototype.getEvents.call(this);
    events.viewprereset = this._onViewPreReset;
    return events;
  },

  /**
   * Handles view pre-reset.
   * @private
   */
  _onViewPreReset: function() {
    this._postponeUpdatePaths = true;
  },

  /**
   * Called when added to map.
   */
  onAdd: function() {
    Renderer.prototype.onAdd.call(this);
    this._draw();
  },

  /**
   * Initializes container.
   * @private
   */
  _initContainer: function() {
    const container = this._container = document.createElement('canvas');
    on(container, 'mousemove', this._onMouseMove, this);
    on(container, 'click dblclick mousedown mouseup contextmenu', this._onClick, this);
    on(container, 'mouseout', this._handleMouseOut, this);
    container['_atlas_disable_events'] = true;
    this._ctx = container.getContext('2d');
  },

  /**
   * Destroys container.
   * @private
   */
  _destroyContainer: function() {
    cancelAnimFrame(this._redrawRequest);
    delete this._ctx;
    remove(this._container);
    off(this._container);
    delete this._container;
  },

  /**
   * Updates paths.
   * @private
   */
  _updatePaths: function() {
    if (this._postponeUpdatePaths) {
      return;
    }
    this._redrawBounds = null;
    for (const id in this._layers) {
      this._layers[id]._update();
    }
    this._redraw();
  },

  /**
   * Updates renderer state.
   * @private
   */
  _update: function() {
    if (this._map._animatingZoom && this._bounds) {
      return;
    }
    Renderer.prototype._update.call(this);
    const b = this._bounds;
    const container = this._container;
    const size = b.getSize();
    const m = Browser.retina ? 2 : 1;
    setPosition(container, b.min);
    container.width = m * size.x;
    container.height = m * size.y;
    container.style.width = size.x + 'px';
    container.style.height = size.y + 'px';
    if (Browser.retina) {
      this._ctx.scale(2, 2);
    }
    this._ctx.translate(-b.min.x, -b.min.y);
    this.fire('update');
  },

  /**
   * Resets renderer.
   * @private
   */
  _reset: function() {
    Renderer.prototype._reset.call(this);
    if (this._postponeUpdatePaths) {
      this._postponeUpdatePaths = false;
      this._updatePaths();
    }
  },

  /**
   * Initializes path.
   * @param {!Path} layer Path layer.
   * @private
   */
  _initPath: function(layer) {
    this._updateDashArray(layer);
    this._layers[stamp(layer)] = layer;
    const order = layer._order = {
      layer: layer,
      prev: this._drawLast,
      next: null,
    };
    if (this._drawLast) {
      this._drawLast.next = order;
    }
    this._drawLast = order;
    this._drawFirst = this._drawFirst || this._drawLast;
  },

  /**
   * Adds path to renderer.
   * @param {!Path} layer Path layer.
   * @private
   */
  _addPath: function(layer) {
    this._requestRedraw(layer);
  },

  /**
   * Removes path from renderer.
   * @param {!Path} layer Path layer.
   * @private
   */
  _removePath: function(layer) {
    const order = layer._order;
    const next = order.next;
    const prev = order.prev;
    if (next) {
      next.prev = prev;
    } else {
      this._drawLast = prev;
    }
    if (prev) {
      prev.next = next;
    } else {
      this._drawFirst = next;
    }
    delete layer._order;
    delete this._layers[stamp(layer)];
    this._requestRedraw(layer);
  },

  /**
   * Updates path.
   * @param {!Path} layer Path layer.
   * @private
   */
  _updatePath: function(layer) {
    this._extendRedrawBounds(layer);
    layer._project();
    layer._update();
    this._requestRedraw(layer);
  },

  /**
   * Updates path style.
   * @param {!Path} layer Path layer.
   * @private
   */
  _updateStyle: function(layer) {
    this._updateDashArray(layer);
    this._requestRedraw(layer);
  },

  /**
   * Updates dash array.
   * @param {!Path} layer Path layer.
   * @private
   */
  _updateDashArray: function(layer) {
    if (typeof layer.options.dashArray === 'string') {
      const parts = layer.options.dashArray.split(/[, ]+/);
      const dashArray = [];
      let dashValue;
      for (let i = 0; i < parts.length; i++) {
        dashValue = Number(parts[i]);
        if (isNaN(dashValue)) {
          return;
        }
        dashArray.push(dashValue);
      }
      layer.options._dashArray = dashArray;
    } else {
      layer.options._dashArray = layer.options.dashArray;
    }
  },

  /**
   * Requests redraw.
   * @param {!Path} layer Path layer.
   * @private
   */
  _requestRedraw: function(layer) {
    if (!this._map) {
      return;
    }
    this._extendRedrawBounds(layer);
    this._redrawRequest = this._redrawRequest ||
        requestAnimFrame(this._redraw, this);
  },

  /**
   * Extends redraw bounds.
   * @param {!Path} layer Path layer.
   * @private
   */
  _extendRedrawBounds: function(layer) {
    if (layer._pxBounds) {
      const padding = (layer.options.weight || 0) + 1;
      this._redrawBounds = this._redrawBounds || new Bounds();
      this._redrawBounds.extend(layer._pxBounds.min.subtract([padding, padding]));
      this._redrawBounds.extend(layer._pxBounds.max.add([padding, padding]));
    }
  },

  /**
   * Redraws canvas.
   * @private
   */
  _redraw: function() {
    this._redrawRequest = null;
    if (this._redrawBounds) {
      this._redrawBounds.min._floor();
      this._redrawBounds.max._ceil();
    }
    this._clear();
    this._draw();
    this._redrawBounds = null;
  },

  /**
   * Clears canvas.
   * @private
   */
  _clear: function() {
    const bounds = this._redrawBounds;
    if (bounds) {
      const size = bounds.getSize();
      this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y);
    } else {
      this._ctx.save();
      this._ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._ctx.clearRect(0, 0, this._container.width, this._container.height);
      this._ctx.restore();
    }
  },

  /**
   * Draws paths.
   * @private
   */
  _draw: function() {
    const layer = null;
    const bounds = this._redrawBounds;
    this._ctx.save();
    if (bounds) {
      const size = bounds.getSize();
      this._ctx.beginPath();
      this._ctx.rect(bounds.min.x, bounds.min.y, size.x, size.y);
      this._ctx.clip();
    }
    this._drawing = true;
    for (let order = this._drawFirst; order; order = order.next) {
      layer = order.layer;
      if (!bounds || (layer._pxBounds && layer._pxBounds.intersects(bounds))) {
        layer._updatePath();
      }
    }
    this._drawing = false;
    this._ctx.restore();
  },

  /**
   * Updates polyline rendering.
   * @param {!Polyline} layer Polyline layer.
   * @param {boolean} closed Whether closed.
   * @private
   */
  _updatePoly: function(layer, closed) {
    if (!this._drawing) {
      return;
    }
    const parts = layer._parts;
    const len = parts.length;
    const ctx = this._ctx;
    if (!len) {
      return;
    }
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      for (let j = 0, len2 = parts[i].length; j < len2; j++) {
        const p = parts[i][j];
        ctx[j ? 'lineTo' : 'moveTo'](p.x, p.y);
      }
      if (closed) {
        ctx.closePath();
      }
    }
    this._fillStroke(ctx, layer);
  },

  /**
   * Updates circle rendering.
   * @param {!CircleMarker} layer Circle layer.
   * @private
   */
  _updateCircle: function(layer) {
    if (!this._drawing || layer._empty()) {
      return;
    }
    const p = layer._point;
    const ctx = this._ctx;
    const r = Math.max(Math.round(layer._radius), 1);
    const s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;
    if (s !== 1) {
      ctx.save();
      ctx.scale(1, s);
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y / s, r, 0, Math.PI * 2, false);
    if (s !== 1) {
      ctx.restore();
    }
    this._fillStroke(ctx, layer);
  },

  /**
   * Fills and strokes path.
   * @param {!CanvasRenderingContext2D} ctx Canvas context.
   * @param {!Path} layer Path layer.
   * @private
   */
  _fillStroke: function(ctx, layer) {
    const options = layer.options;
    if (options.fill) {
      ctx.globalAlpha = options.fillOpacity;
      ctx.fillStyle = options.fillColor || options.color;
      ctx.fill(options.fillRule || 'evenodd');
    }
    if (options.stroke && options.weight !== 0) {
      if (ctx.setLineDash) {
        ctx.setLineDash(layer.options && layer.options._dashArray || []);
      }
      ctx.globalAlpha = options.opacity;
      ctx.lineWidth = options.weight;
      ctx.strokeStyle = options.color;
      ctx.lineCap = options.lineCap;
      ctx.lineJoin = options.lineJoin;
      ctx.stroke();
    }
  },

  /**
   * Handles click events.
   * @param {Event} e Mouse event.
   * @private
   */
  _onClick: function(e) {
    const point = this._map.mouseEventToLayerPoint(e);
    let layer;
    let clickedLayer = null;
    for (let order = this._drawFirst; order; order = order.next) {
      layer = order.layer;
      if (layer.options.interactive && layer._containsPoint(point)) {
        if (!(e.type === 'click' || e.type === 'preclick') ||
            !this._map._draggableMoved(layer)) {
          clickedLayer = layer;
        }
      }
    }
    this._fireEvent(clickedLayer ? [clickedLayer] : false, e);
  },

  /**
   * Handles mouse move.
   * @param {Event} e Mouse event.
   * @private
   */
  _onMouseMove: function(e) {
    if (!this._map || this._map.dragging.moving() ||
        this._map._animatingZoom) {
      return;
    }
    const point = this._map.mouseEventToLayerPoint(e);
    this._handleMouseHover(e, point);
  },

  /**
   * Handles mouse out.
   * @param {Event} e Mouse event.
   * @private
   */
  _handleMouseOut: function(e) {
    const layer = this._hoveredLayer;
    if (layer) {
      removeClass(this._container, 'atlas-interactive');
      this._fireEvent([layer], e, 'mouseout');
      this._hoveredLayer = null;
      this._mouseHoverThrottled = false;
    }
  },

  /**
   * Handles mouse hover.
   * @param {Event} e Mouse event.
   * @param {!Point} point Layer point.
   * @private
   */
  _handleMouseHover: function(e, point) {
    if (this._mouseHoverThrottled) {
      return;
    }
    let layer;
    let candidateHoveredLayer = null;
    for (let order = this._drawFirst; order; order = order.next) {
      layer = order.layer;
      if (layer.options.interactive && layer._containsPoint(point)) {
        candidateHoveredLayer = layer;
      }
    }
    if (candidateHoveredLayer !== this._hoveredLayer) {
      this._handleMouseOut(e);
      if (candidateHoveredLayer) {
        addClass(this._container, 'atlas-interactive');
        this._fireEvent([candidateHoveredLayer], e, 'mouseover');
        this._hoveredLayer = candidateHoveredLayer;
      }
    }
    this._fireEvent(this._hoveredLayer ? [this._hoveredLayer] : false, e);
    this._mouseHoverThrottled = true;
    setTimeout(bind(function() {
      this._mouseHoverThrottled = false;
    }, this), 32);
  },

  /**
   * Fires DOM event.
   * @param {Array<!Layer>|boolean} layers Layers or false.
   * @param {Event} e Event.
   * @param {string=} type Event type.
   * @private
   */
  _fireEvent: function(layers, e, type) {
    this._map._fireDOMEvent(e, type || e.type, layers);
  },

  /**
   * Brings path to front.
   * @param {!Path} layer Path layer.
   * @private
   */
  _bringToFront: function(layer) {
    const order = layer._order;
    if (!order) {
      return;
    }
    const next = order.next;
    const prev = order.prev;
    if (next) {
      next.prev = prev;
    } else {
      return;
    }
    if (prev) {
      prev.next = next;
    } else if (next) {
      this._drawFirst = next;
    }
    order.prev = this._drawLast;
    this._drawLast.next = order;
    order.next = null;
    this._drawLast = order;
    this._requestRedraw(layer);
  },

  /**
   * Brings path to back.
   * @param {!Path} layer Path layer.
   * @private
   */
  _bringToBack: function(layer) {
    const order = layer._order;
    if (!order) {
      return;
    }
    const next = order.next;
    const prev = order.prev;
    if (prev) {
      prev.next = next;
    } else {
      return;
    }
    if (next) {
      next.prev = prev;
    } else if (prev) {
      this._drawLast = prev;
    }
    order.prev = null;
    order.next = this._drawFirst;
    this._drawFirst.prev = order;
    this._drawFirst = order;
    this._requestRedraw(layer);
  },
});

/**
 * Creates a canvas renderer.
 * @param {Object=} options Renderer options.
 * @return {Canvas|null} New canvas renderer or null if not supported.
 */
function canvas(options) {
  return Browser.canvas ? new Canvas(options) : null;
}

/**
 * SVG renderer.
 * @extends {Renderer}
 */
const SVG = Renderer.extend(/** @lends SVG.prototype */ {
  /**
   * Initializes container.
   * @private
   */
  _initContainer: function() {
    this._container = create('svg');
    this._container.setAttribute('pointer-events', 'none');
    this._rootGroup = create('g');
    this._container.appendChild(this._rootGroup);
  },

  /**
   * Destroys container.
   * @private
   */
  _destroyContainer: function() {
    remove(this._container);
    off(this._container);
    delete this._container;
    delete this._rootGroup;
    delete this._svgSize;
  },

  /**
   * Updates renderer state.
   * @private
   */
  _update: function() {
    if (this._map._animatingZoom && this._bounds) {
      return;
    }
    Renderer.prototype._update.call(this);
    const b = this._bounds;
    const size = b.getSize();
    const container = this._container;
    if (!this._svgSize || !this._svgSize.equals(size)) {
      this._svgSize = size;
      container.setAttribute('width', size.x);
      container.setAttribute('height', size.y);
    }
    setPosition(container, b.min);
    container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));
    this.fire('update');
  },

  /**
   * Initializes path.
   * @param {!Path} layer Path layer.
   * @private
   */
  _initPath: function(layer) {
    const path = layer._path = create('path');
    if (layer.options.className) {
      addClass(path, layer.options.className);
    }
    if (layer.options.interactive) {
      addClass(path, 'atlas-interactive');
    }
    this._updateStyle(layer);
    this._layers[stamp(layer)] = layer;
  },

  /**
   * Adds path to renderer.
   * @param {!Path} layer Path layer.
   * @private
   */
  _addPath: function(layer) {
    if (!this._rootGroup) {
      this._initContainer();
    }
    this._rootGroup.appendChild(layer._path);
    layer.addInteractiveTarget(layer._path);
  },

  /**
   * Removes path from renderer.
   * @param {!Path} layer Path layer.
   * @private
   */
  _removePath: function(layer) {
    remove(layer._path);
    layer.removeInteractiveTarget(layer._path);
    delete this._layers[stamp(layer)];
  },

  /**
   * Updates path.
   * @param {!Path} layer Path layer.
   * @private
   */
  _updatePath: function(layer) {
    layer._project();
    layer._update();
  },

  /**
   * Updates path style.
   * @param {!Path} layer Path layer.
   * @private
   */
  _updateStyle: function(layer) {
    const path = layer._path;
    const options = layer.options;
    if (!path) {
      return;
    }
    if (options.stroke) {
      path.setAttribute('stroke', options.color);
      path.setAttribute('stroke-opacity', options.opacity);
      path.setAttribute('stroke-width', options.weight);
      path.setAttribute('stroke-linecap', options.lineCap);
      path.setAttribute('stroke-linejoin', options.lineJoin);
      if (options.dashArray) {
        path.setAttribute('stroke-dasharray', options.dashArray);
      } else {
        path.removeAttribute('stroke-dasharray');
      }
      if (options.dashOffset) {
        path.setAttribute('stroke-dashoffset', options.dashOffset);
      } else {
        path.removeAttribute('stroke-dashoffset');
      }
    } else {
      path.setAttribute('stroke', 'none');
    }
    if (options.fill) {
      path.setAttribute('fill', options.fillColor || options.color);
      path.setAttribute('fill-opacity', options.fillOpacity);
      path.setAttribute('fill-rule', options.fillRule || 'evenodd');
    } else {
      path.setAttribute('fill', 'none');
    }
  },

  /**
   * Updates polyline rendering.
   * @param {!Polyline} layer Polyline layer.
   * @param {boolean} closed Whether closed.
   * @private
   */
  _updatePoly: function(layer, closed) {
    this._setPath(layer, pointsToPath(layer._parts, closed));
  },

  /**
   * Updates circle rendering.
   * @param {!CircleMarker} layer Circle layer.
   * @private
   */
  _updateCircle: function(layer) {
    const p = layer._point;
    const r = Math.max(Math.round(layer._radius), 1);
    const r2 = Math.max(Math.round(layer._radiusY), 1) || r;
    const arc = 'a' + r + ',' + r2 + ' 0 1,0 ';
    const d = layer._empty() ? 'M0 0' :
        'M' + (p.x - r) + ',' + p.y +
        arc + (r * 2) + ',0 ' +
        arc + (-r * 2) + ',0 ';
    this._setPath(layer, d);
  },

  /**
   * Sets path data.
   * @param {!Path} layer Path layer.
   * @param {string} path Path data.
   * @private
   */
  _setPath: function(layer, path) {
    layer._path.setAttribute('d', path);
  },

  /**
   * Brings path to front.
   * @param {!Path} layer Path layer.
   * @private
   */
  _bringToFront: function(layer) {
    toFront(layer._path);
  },

  /**
   * Brings path to back.
   * @param {!Path} layer Path layer.
   * @private
   */
  _bringToBack: function(layer) {
    toBack(layer._path);
  },
});

/**
 * Creates an SVG renderer.
 * @param {Object=} options Renderer options.
 * @return {SVG|null} New SVG renderer or null if not supported.
 */
function svg(options) {
  return Browser.svg ? new SVG(options) : null;
}

// Add renderer methods to Map
Map.include({
  /**
   * Gets renderer for layer.
   * @param {!Layer} layer Layer.
   * @return {!Renderer} Renderer instance.
   */
  getRenderer: function(layer) {
    let renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) ||
        this.options.renderer || this._renderer;
    if (!renderer) {
      renderer = this._renderer = this._createRenderer();
    }
    if (!this.hasLayer(renderer)) {
      this.addLayer(renderer);
    }
    return renderer;
  },

  /**
   * Gets renderer for pane.
   * @param {string=} name Pane name.
   * @return {Renderer|undefined} Renderer or undefined.
   * @private
   */
  _getPaneRenderer: function(name) {
    if (name === 'overlayPane' || name === undefined) {
      return false;
    }
    let renderer = this._paneRenderers[name];
    if (renderer === undefined) {
      renderer = this._createRenderer({pane: name});
      this._paneRenderers[name] = renderer;
    }
    return renderer;
  },

  /**
   * Creates renderer.
   * @param {Object=} options Renderer options.
   * @return {!Renderer} New renderer.
   * @private
   */
  _createRenderer: function(options) {
    return (this.options.preferCanvas && canvas(options)) || svg(options);
  },
});

// Export SVG utilities
SVG.create = create;
SVG.pointsToPath = pointsToPath;
