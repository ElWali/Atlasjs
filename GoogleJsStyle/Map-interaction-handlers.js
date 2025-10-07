/**
 * Base handler class for map interactions.
 * @extends {Class}
 */
const Handler = Class.extend(/** @lends Handler.prototype */ {
  /**
   * @param {!Map} map Map instance.
   */
  initialize: function(map) {
    this._map = map;
  },

  /**
   * Enables the handler.
   * @return {!Handler} This handler.
   */
  enable: function() {
    if (this._enabled) {
      return this;
    }
    this._enabled = true;
    this.addHooks();
    return this;
  },

  /**
   * Disables the handler.
   * @return {!Handler} This handler.
   */
  disable: function() {
    if (!this._enabled) {
      return this;
    }
    this._enabled = false;
    this.removeHooks();
    return this;
  },

  /**
   * Checks if handler is enabled.
   * @return {boolean} Whether enabled.
   */
  enabled: function() {
    return !!this._enabled;
  },
});

/**
 * Adds handler to map class.
 * @param {!Map} map Map instance.
 * @param {string} name Handler name.
 * @return {!Function} Handler class.
 */
Handler.addTo = function(map, name) {
  map.addHandler(name, this);
  return this;
};

// Add handler options to Map
Map.mergeOptions({
  dragging: true,
  inertia: true,
  inertiaDeceleration: 3400,
  inertiaMaxSpeed: Infinity,
  easeLinearity: 0.2,
  worldCopyJump: false,
  maxBoundsViscosity: 0.0,
  doubleClickZoom: true,
  scrollWheelZoom: true,
  wheelDebounceTime: 40,
  wheelPxPerZoomLevel: 60,
  keyboard: true,
  keyboardPanDelta: 80,
  boxZoom: true,
  touchZoom: Browser.touch,
  bounceAtZoomLimits: true,
  tapHold: Browser.touchNative && Browser.safari && Browser.mobile,
  tapTolerance: 15,
});

/**
 * Map dragging handler (panning).
 * @extends {Handler}
 */
const Drag = Handler.extend(/** @lends Drag.prototype */ {
  /**
   * Adds dragging hooks.
   */
  addHooks: function() {
    if (!this._draggable) {
      const map = this._map;
      this._draggable = new Draggable(map._mapPane, map._container);
      this._draggable.on({
        dragstart: this._onDragStart,
        drag: this._onDrag,
        dragend: this._onDragEnd,
      }, this);
      this._draggable.on('predrag', this._onPreDragLimit, this);
      if (map.options.worldCopyJump) {
        this._draggable.on('predrag', this._onPreDragWrap, this);
        map.on('zoomend', this._onZoomEnd, this);
        map.whenReady(this._onZoomEnd, this);
      }
    }
    addClass(this._map._container, 'atlas-grab atlas-touch-drag');
    this._draggable.enable();
    this._positions = [];
    this._times = [];
  },

  /**
   * Removes dragging hooks.
   */
  removeHooks: function() {
    removeClass(this._map._container, 'atlas-grab');
    removeClass(this._map._container, 'atlas-touch-drag');
    this._draggable.disable();
  },

  /**
   * Checks if map was moved.
   * @return {boolean} Whether moved.
   */
  moved: function() {
    return this._draggable && this._draggable._moved;
  },

  /**
   * Checks if map is moving.
   * @return {boolean} Whether moving.
   */
  moving: function() {
    return this._draggable && this._draggable._moving;
  },

  /**
   * Handles drag start.
   * @private
   */
  _onDragStart: function() {
    const map = this._map;
    map._stop();
    if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
      const bounds = toLatLngBounds(this._map.options.maxBounds);
      this._offsetLimit = toBounds(
          this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
          this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1)
              .add(this._map.getSize()));
      this._viscosity = Math.min(1.0, Math.max(0.0, this._map.options.maxBoundsViscosity));
    } else {
      this._offsetLimit = null;
    }
    map
        .fire('movestart')
        .fire('dragstart');
    if (map.options.inertia) {
      this._positions = [];
      this._times = [];
    }
  },

  /**
   * Handles drag.
   * @param {!Object} e Drag event.
   * @private
   */
  _onDrag: function(e) {
    if (this._map.options.inertia) {
      const time = this._lastTime = +new Date();
      const pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;
      this._positions.push(pos);
      this._times.push(time);
      this._prunePositions(time);
    }
    this._map
        .fire('move', e)
        .fire('drag', e);
  },

  /**
   * Prunes old positions for inertia calculation.
   * @param {number} time Current time.
   * @private
   */
  _prunePositions: function(time) {
    while (this._positions.length > 1 && time - this._times[0] > 50) {
      this._positions.shift();
      this._times.shift();
    }
  },

  /**
   * Handles zoom end for world copy jump.
   * @private
   */
  _onZoomEnd: function() {
    const pxCenter = this._map.getSize().divideBy(2);
    const pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);
    this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
    this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
  },

  /**
   * Applies viscous limit to offset.
   * @param {number} value Input value.
   * @param {number} threshold Limit threshold.
   * @return {number} Limited value.
   * @private
   */
  _viscousLimit: function(value, threshold) {
    return value - (value - threshold) * this._viscosity;
  },

  /**
   * Limits drag offset within max bounds.
   * @private
   */
  _onPreDragLimit: function() {
    if (!this._viscosity || !this._offsetLimit) {
      return;
    }
    let offset = this._draggable._newPos.subtract(this._draggable._startPos);
    const limit = this._offsetLimit;
    if (offset.x < limit.min.x) {
      offset.x = this._viscousLimit(offset.x, limit.min.x);
    }
    if (offset.y < limit.min.y) {
      offset.y = this._viscousLimit(offset.y, limit.min.y);
    }
    if (offset.x > limit.max.x) {
      offset.x = this._viscousLimit(offset.x, limit.max.x);
    }
    if (offset.y > limit.max.y) {
      offset.y = this._viscousLimit(offset.y, limit.max.y);
    }
    this._draggable._newPos = this._draggable._startPos.add(offset);
  },

  /**
   * Handles world copy jump during drag.
   * @private
   */
  _onPreDragWrap: function() {
    const worldWidth = this._worldWidth;
    const halfWidth = Math.round(worldWidth / 2);
    const dx = this._initialWorldOffset;
    const x = this._draggable._newPos.x;
    const newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx;
    const newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx;
    const newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;
    this._draggable._absPos = this._draggable._newPos.clone();
    this._draggable._newPos.x = newX;
  },

  /**
   * Handles drag end with inertia.
   * @param {!Object} e Drag end event.
   * @private
   */
  _onDragEnd: function(e) {
    const map = this._map;
    const options = map.options;
    const noInertia = !options.inertia || e.noInertia || this._times.length < 2;
    map.fire('dragend', e);
    if (noInertia) {
      map.fire('moveend');
    } else {
      this._prunePositions(+new Date());
      const direction = this._lastPos.subtract(this._positions[0]);
      const duration = (this._lastTime - this._times[0]) / 1000;
      const ease = options.easeLinearity;
      const speedVector = direction.multiplyBy(ease / duration);
      const speed = speedVector.distanceTo([0, 0]);
      const limitedSpeed = Math.min(options.inertiaMaxSpeed, speed);
      const limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed);
      const decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease);
      let offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();
      if (!offset.x && !offset.y) {
        map.fire('moveend');
      } else {
        offset = map._limitOffset(offset, map.options.maxBounds);
        requestAnimFrame(function() {
          map.panBy(offset, {
            duration: decelerationDuration,
            easeLinearity: ease,
            noMoveStart: true,
            animate: true,
          });
        });
      }
    }
  },
});

Map.addInitHook('addHandler', 'dragging', Drag);

/**
 * Double-click zoom handler.
 * @extends {Handler}
 */
const DoubleClickZoom = Handler.extend(/** @lends DoubleClickZoom.prototype */ {
  /**
   * Adds double-click hooks.
   */
  addHooks: function() {
    this._map.on('dblclick', this._onDoubleClick, this);
  },

  /**
   * Removes double-click hooks.
   */
  removeHooks: function() {
    this._map.off('dblclick', this._onDoubleClick, this);
  },

  /**
   * Handles double-click event.
   * @param {!Object} e Double-click event.
   * @private
   */
  _onDoubleClick: function(e) {
    const map = this._map;
    const oldZoom = map.getZoom();
    const delta = map.options.zoomDelta;
    const zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;
    if (map.options.doubleClickZoom === 'center') {
      map.setZoom(zoom);
    } else {
      map.setZoomAround(e.containerPoint, zoom);
    }
  },
});

Map.addInitHook('addHandler', 'doubleClickZoom', DoubleClickZoom);

/**
 * Scroll wheel zoom handler.
 * @extends {Handler}
 */
const ScrollWheelZoom = Handler.extend(/** @lends ScrollWheelZoom.prototype */ {
  /**
   * Adds scroll wheel hooks.
   */
  addHooks: function() {
    on(this._map._container, 'wheel', this._onWheelScroll, this);
    this._delta = 0;
  },

  /**
   * Removes scroll wheel hooks.
   */
  removeHooks: function() {
    off(this._map._container, 'wheel', this._onWheelScroll, this);
  },

  /**
   * Handles wheel scroll event.
   * @param {Event} e Wheel event.
   * @private
   */
  _onWheelScroll: function(e) {
    const delta = getWheelDelta(e);
    const debounce = this._map.options.wheelDebounceTime;
    this._delta += delta;
    this._lastMousePos = this._map.mouseEventToContainerPoint(e);
    if (!this._startTime) {
      this._startTime = +new Date();
    }
    const left = Math.max(debounce - (+new Date() - this._startTime), 0);
    clearTimeout(this._timer);
    this._timer = setTimeout(bind(this._performZoom, this), left);
    stop(e);
  },

  /**
   * Performs zoom based on accumulated delta.
   * @private
   */
  _performZoom: function() {
    const map = this._map;
    const zoom = map.getZoom();
    const snap = this._map.options.zoomSnap || 0;
    map._stop();
    const d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4);
    const d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2;
    const d4 = snap ? Math.ceil(d3 / snap) * snap : d3;
    const delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;
    this._delta = 0;
    this._startTime = null;
    if (!delta) {
      return;
    }
    if (map.options.scrollWheelZoom === 'center') {
      map.setZoom(zoom + delta);
    } else {
      map.setZoomAround(this._lastMousePos, zoom + delta);
    }
  },
});

Map.addInitHook('addHandler', 'scrollWheelZoom', ScrollWheelZoom);

/**
 * Box zoom handler (shift+drag to zoom to area).
 * @extends {Handler}
 */
const BoxZoom = Handler.extend(/** @lends BoxZoom.prototype */ {
  /**
   * @param {!Map} map Map instance.
   */
  initialize: function(map) {
    this._map = map;
    this._container = map._container;
    this._pane = map._panes.overlayPane;
    this._resetStateTimeout = 0;
    map.on('unload', this._destroy, this);
  },

  /**
   * Adds box zoom hooks.
   */
  addHooks: function() {
    on(this._container, 'mousedown', this._onMouseDown, this);
  },

  /**
   * Removes box zoom hooks.
   */
  removeHooks: function() {
    off(this._container, 'mousedown', this._onMouseDown, this);
  },

  /**
   * Checks if box was moved.
   * @return {boolean} Whether moved.
   */
  moved: function() {
    return this._moved;
  },

  /**
   * Destroys box zoom elements.
   * @private
   */
  _destroy: function() {
    remove(this._pane);
    delete this._pane;
  },

  /**
   * Resets state after zoom.
   * @private
   */
  _resetState: function() {
    this._resetStateTimeout = 0;
    this._moved = false;
  },

  /**
   * Clears deferred reset state.
   * @private
   */
  _clearDeferredResetState: function() {
    if (this._resetStateTimeout !== 0) {
      clearTimeout(this._resetStateTimeout);
      this._resetStateTimeout = 0;
    }
  },

  /**
   * Handles mouse down for box zoom.
   * @param {Event} e Mouse event.
   * @private
   */
  _onMouseDown: function(e) {
    if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) {
      return false;
    }
    this._clearDeferredResetState();
    this._resetState();
    disableTextSelection();
    disableImageDrag();
    this._startPoint = this._map.mouseEventToContainerPoint(e);
    on(document, {
      contextmenu: stop,
      mousemove: this._onMouseMove,
      mouseup: this._onMouseUp,
      keydown: this._onKeyDown,
    }, this);
  },

  /**
   * Handles mouse move during box selection.
   * @param {Event} e Mouse event.
   * @private
   */
  _onMouseMove: function(e) {
    if (!this._moved) {
      this._moved = true;
      this._box = create$1('div', 'atlas-zoom-box', this._container);
      addClass(this._container, 'atlas-crosshair');
      this._map.fire('boxzoomstart');
    }
    this._point = this._map.mouseEventToContainerPoint(e);
    const bounds = new Bounds(this._point, this._startPoint);
    const size = bounds.getSize();
    setPosition(this._box, bounds.min);
    this._box.style.width = size.x + 'px';
    this._box.style.height = size.y + 'px';
  },

  /**
   * Finishes box zoom operation.
   * @private
   */
  _finish: function() {
    if (this._moved) {
      remove(this._box);
      removeClass(this._container, 'atlas-crosshair');
    }
    enableTextSelection();
    enableImageDrag();
    off(document, {
      contextmenu: stop,
      mousemove: this._onMouseMove,
      mouseup: this._onMouseUp,
      keydown: this._onKeyDown,
    }, this);
  },

  /**
   * Handles mouse up to complete zoom.
   * @param {Event} e Mouse event.
   * @private
   */
  _onMouseUp: function(e) {
    if ((e.which !== 1) && (e.button !== 1)) {
      return;
    }
    this._finish();
    if (!this._moved) {
      return;
    }
    this._clearDeferredResetState();
    this._resetStateTimeout = setTimeout(bind(this._resetState, this), 0);
    const bounds = new LatLngBounds(
        this._map.containerPointToLatLng(this._startPoint),
        this._map.containerPointToLatLng(this._point));
    this._map
        .fitBounds(bounds)
        .fire('boxzoomend', {boxZoomBounds: bounds});
  },

  /**
   * Handles key down (Escape to cancel).
   * @param {Event} e Key event.
   * @private
   */
  _onKeyDown: function(e) {
    if (e.keyCode === 27) {
      this._finish();
      this._clearDeferredResetState();
      this._resetState();
    }
  },
});

Map.addInitHook('addHandler', 'boxZoom', BoxZoom);

/**
 * Keyboard navigation handler.
 * @extends {Handler}
 */
const Keyboard = Handler.extend(/** @lends Keyboard.prototype */ {
  /**
   * @type {!Object}
   */
  keyCodes: {
    left: [37],
    right: [39],
    down: [40],
    up: [38],
    zoomIn: [187, 107, 61, 171],
    zoomOut: [189, 109, 54, 173],
  },

  /**
   * @param {!Map} map Map instance.
   */
  initialize: function(map) {
    this._map = map;
    this._setPanDelta(map.options.keyboardPanDelta);
    this._setZoomDelta(map.options.zoomDelta);
  },

  /**
   * Adds keyboard hooks.
   */
  addHooks: function() {
    const container = this._map._container;
    if (container.tabIndex <= 0) {
      container.tabIndex = '0';
    }
    on(container, {
      focus: this._onFocus,
      blur: this._onBlur,
      mousedown: this._onMouseDown,
    }, this);
    this._map.on({
      focus: this._addHooks,
      blur: this._removeHooks,
    }, this);
  },

  /**
   * Removes keyboard hooks.
   */
  removeHooks: function() {
    this._removeHooks();
    off(this._map._container, {
      focus: this._onFocus,
      blur: this._onBlur,
      mousedown: this._onMouseDown,
    }, this);
    this._map.off({
      focus: this._addHooks,
      blur: this._removeHooks,
    }, this);
  },

  /**
   * Handles mouse down to focus map.
   * @param {Event} e Mouse event.
   * @private
   */
  _onMouseDown: function() {
    if (this._focused) {
      return;
    }
    const body = document.body;
    const docEl = document.documentElement;
    const top = body.scrollTop || docEl.scrollTop;
    const left = body.scrollLeft || docEl.scrollLeft;
    this._map._container.focus();
    window.scrollTo(left, top);
  },

  /**
   * Handles focus event.
   * @private
   */
  _onFocus: function() {
    this._focused = true;
    this._map.fire('focus');
  },

  /**
   * Handles blur event.
   * @private
   */
  _onBlur: function() {
    this._focused = false;
    this._map.fire('blur');
  },

  /**
   * Sets pan delta for arrow keys.
   * @param {number} panDelta Pan distance in pixels.
   * @private
   */
  _setPanDelta: function(panDelta) {
    const keys = this._panKeys = {};
    const codes = this.keyCodes;
    let i, len;
    for (i = 0, len = codes.left.length; i < len; i++) {
      keys[codes.left[i]] = [-1 * panDelta, 0];
    }
    for (i = 0, len = codes.right.length; i < len; i++) {
      keys[codes.right[i]] = [panDelta, 0];
    }
    for (i = 0, len = codes.down.length; i < len; i++) {
      keys[codes.down[i]] = [0, panDelta];
    }
    for (i = 0, len = codes.up.length; i < len; i++) {
      keys[codes.up[i]] = [0, -1 * panDelta];
    }
  },

  /**
   * Sets zoom delta for +/- keys.
   * @param {number} zoomDelta Zoom step.
   * @private
   */
  _setZoomDelta: function(zoomDelta) {
    const keys = this._zoomKeys = {};
    const codes = this.keyCodes;
    let i, len;
    for (i = 0, len = codes.zoomIn.length; i < len; i++) {
      keys[codes.zoomIn[i]] = zoomDelta;
    }
    for (i = 0, len = codes.zoomOut.length; i < len; i++) {
      keys[codes.zoomOut[i]] = -zoomDelta;
    }
  },

  /**
   * Adds document keydown listener.
   * @private
   */
  _addHooks: function() {
    on(document, 'keydown', this._onKeyDown, this);
  },

  /**
   * Removes document keydown listener.
   * @private
   */
  _removeHooks: function() {
    off(document, 'keydown', this._onKeyDown, this);
  },

  /**
   * Handles key down events.
   * @param {Event} e Key event.
   * @private
   */
  _onKeyDown: function(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) {
      return;
    }
    const key = e.keyCode;
    const map = this._map;
    let offset;
    if (key in this._panKeys) {
      if (!map._panAnim || !map._panAnim._inProgress) {
        offset = this._panKeys[key];
        if (e.shiftKey) {
          offset = toPoint(offset).multiplyBy(3);
        }
        if (map.options.maxBounds) {
          offset = map._limitOffset(toPoint(offset), map.options.maxBounds);
        }
        if (map.options.worldCopyJump) {
          const newLatLng = map.wrapLatLng(map.unproject(map.project(map.getCenter()).add(offset)));
          map.panTo(newLatLng);
        } else {
          map.panBy(offset);
        }
      }
    } else if (key in this._zoomKeys) {
      map.setZoom(map.getZoom() + (e.shiftKey ? 3 : 1) * this._zoomKeys[key]);
    } else if (key === 27 && map._popup && map._popup.options.closeOnEscapeKey) {
      map.closePopup();
    } else {
      return;
    }
    stop(e);
  },
});

Map.addInitHook('addHandler', 'keyboard', Keyboard);

/**
 * Touch zoom handler (pinch zoom).
 * @extends {Handler}
 */
const TouchZoom = Handler.extend(/** @lends TouchZoom.prototype */ {
  /**
   * Adds touch zoom hooks.
   */
  addHooks: function() {
    addClass(this._map._container, 'atlas-touch-zoom');
    on(this._map._container, 'touchstart', this._onTouchStart, this);
  },

  /**
   * Removes touch zoom hooks.
   */
  removeHooks: function() {
    removeClass(this._map._container, 'atlas-touch-zoom');
    off(this._map._container, 'touchstart', this._onTouchStart, this);
  },

  /**
   * Handles touch start for pinch zoom.
   * @param {Event} e Touch event.
   * @private
   */
  _onTouchStart: function(e) {
    const map = this._map;
    if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) {
      return;
    }
    const p1 = map.mouseEventToContainerPoint(e.touches[0]);
    const p2 = map.mouseEventToContainerPoint(e.touches[1]);
    this._centerPoint = map.getSize()._divideBy(2);
    this._startLatLng = map.containerPointToLatLng(this._centerPoint);
    if (map.options.touchZoom !== 'center') {
      this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
    }
    this._startDist = p1.distanceTo(p2);
    this._startZoom = map.getZoom();
    this._moved = false;
    this._zooming = true;
    map._stop();
    on(document, 'touchmove', this._onTouchMove, this);
    on(document, 'touchend touchcancel', this._onTouchEnd, this);
    preventDefault(e);
  },

  /**
   * Handles touch move during pinch.
   * @param {Event} e Touch event.
   * @private
   */
  _onTouchMove: function(e) {
    if (!e.touches || e.touches.length !== 2 || !this._zooming) {
      return;
    }
    const map = this._map;
    const p1 = map.mouseEventToContainerPoint(e.touches[0]);
    const p2 = map.mouseEventToContainerPoint(e.touches[1]);
    const scale = p1.distanceTo(p2) / this._startDist;
    this._zoom = map.getScaleZoom(scale, this._startZoom);
    if (!map.options.bounceAtZoomLimits &&
        ((this._zoom < map.getMinZoom() && scale < 1) ||
         (this._zoom > map.getMaxZoom() && scale > 1))) {
      this._zoom = map._limitZoom(this._zoom);
    }
    if (map.options.touchZoom === 'center') {
      this._center = this._startLatLng;
      if (scale === 1) {
        return;
      }
    } else {
      const delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
      if (scale === 1 && delta.x === 0 && delta.y === 0) {
        return;
      }
      this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
    }
    if (!this._moved) {
      map._moveStart(true, false);
      this._moved = true;
    }
    cancelAnimFrame(this._animRequest);
    const moveFn = bind(map._move, map, this._center, this._zoom, {pinch: true, round: false}, undefined);
    this._animRequest = requestAnimFrame(moveFn, this, true);
    preventDefault(e);
  },

  /**
   * Handles touch end to complete zoom.
   * @private
   */
  _onTouchEnd: function() {
    if (!this._moved || !this._zooming) {
      this._zooming = false;
      return;
    }
    this._zooming = false;
    cancelAnimFrame(this._animRequest);
    off(document, 'touchmove', this._onTouchMove, this);
    off(document, 'touchend touchcancel', this._onTouchEnd, this);
    if (this._map.options.zoomAnimation) {
      this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
    } else {
      this._map._resetView(this._center, this._map._limitZoom(this._zoom));
    }
  },
});

Map.addInitHook('addHandler', 'touchZoom', TouchZoom);

/**
 * Tap-and-hold handler for context menu on touch devices.
 * @extends {Handler}
 */
const TapHold = Handler.extend(/** @lends TapHold.prototype */ {
  /**
   * Adds tap hold hooks.
   */
  addHooks: function() {
    on(this._map._container, 'touchstart', this._onDown, this);
  },

  /**
   * Removes tap hold hooks.
   */
  removeHooks: function() {
    off(this._map._container, 'touchstart', this._onDown, this);
  },

  /**
   * Handles touch start for tap hold.
   * @param {Event} e Touch event.
   * @private
   */
  _onDown: function(e) {
    clearTimeout(this._holdTimeout);
    if (e.touches.length !== 1) {
      return;
    }
    const first = e.touches[0];
    this._startPos = this._newPos = new Point(first.clientX, first.clientY);
    this._holdTimeout = setTimeout(bind(function() {
      this._cancel();
      if (!this._isTapValid()) {
        return;
      }
      on(document, 'touchend', preventDefault);
      on(document, 'touchend touchcancel', this._cancelClickPrevent);
      this._simulateEvent('contextmenu', first);
    }, this), tapHoldDelay);
    on(document, 'touchend touchcancel contextmenu', this._cancel, this);
    on(document, 'touchmove', this._onMove, this);
  },

  /**
   * Cancels click prevention.
   * @private
   */
  _cancelClickPrevent: function() {
    off(document, 'touchend', preventDefault);
    off(document, 'touchend touchcancel', this._cancelClickPrevent);
  },

  /**
   * Cancels tap hold operation.
   * @private
   */
  _cancel: function() {
    clearTimeout(this._holdTimeout);
    off(document, 'touchend touchcancel contextmenu', this._cancel, this);
    off(document, 'touchmove', this._onMove, this);
  },

  /**
   * Handles touch move during tap hold.
   * @param {Event} e Touch event.
   * @private
   */
  _onMove: function(e) {
    const first = e.touches[0];
    this._newPos = new Point(first.clientX, first.clientY);
  },

  /**
   * Validates tap (checks movement tolerance).
   * @return {boolean} Whether valid.
   * @private
   */
  _isTapValid: function() {
    return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
  },

  /**
   * Simulates mouse event.
   * @param {string} type Event type.
   * @param {!Object} e Original touch.
   * @private
   */
  _simulateEvent: function(type, e) {
    const simulatedEvent = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      screenX: e.screenX,
      screenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    simulatedEvent._simulated = true;
    e.target.dispatchEvent(simulatedEvent);
  },
});

const tapHoldDelay = 600;

Map.addInitHook('addHandler', 'tapHold', TapHold);

// Export handler classes
Map.BoxZoom = BoxZoom;
Map.DoubleClickZoom = DoubleClickZoom;
Map.Drag = Drag;
Map.Keyboard = Keyboard;
Map.ScrollWheelZoom = ScrollWheelZoom;
Map.TapHold = TapHold;
Map.TouchZoom = TouchZoom;
