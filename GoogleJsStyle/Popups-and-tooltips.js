/**
 * Base class for popup-like overlays.
 * @extends {Layer}
 */
const DivOverlay = Layer.extend(/** @lends DivOverlay.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    interactive: false,
    offset: [0, 0],
    className: '',
    pane: undefined,
    content: '',
  },

  /**
   * @param {Object|LatLng|LatLng[]} options Options or LatLng.
   * @param {Layer=} source Source layer.
   */
  initialize: function(options, source) {
    if (options && (options instanceof LatLng || isArray(options))) {
      this._latlng = toLatLng(options);
      setOptions(this, source);
    } else {
      setOptions(this, options);
      this._source = source;
    }
    if (this.options.content) {
      this._content = this.options.content;
    }
  },

  /**
   * Opens overlay on map.
   * @param {Map=} map Map instance.
   * @return {!DivOverlay} This overlay.
   */
  openOn: function(map) {
    map = arguments.length ? map : this._source._map;
    if (!map.hasLayer(this)) {
      map.addLayer(this);
    }
    return this;
  },

  /**
   * Closes overlay.
   * @return {!DivOverlay} This overlay.
   */
  close: function() {
    if (this._map) {
      this._map.removeLayer(this);
    }
    return this;
  },

  /**
   * Toggles overlay visibility.
   * @param {Layer=} layer Source layer.
   * @return {!DivOverlay} This overlay.
   */
  toggle: function(layer) {
    if (this._map) {
      this.close();
    } else {
      if (arguments.length) {
        this._source = layer;
      } else {
        layer = this._source;
      }
      this._prepareOpen();
      this.openOn(layer._map);
    }
    return this;
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   */
  onAdd: function(map) {
    this._zoomAnimated = map._zoomAnimated;
    if (!this._container) {
      this._initLayout();
    }
    if (map._fadeAnimated) {
      setOpacity(this._container, 0);
    }
    clearTimeout(this._removeTimeout);
    this.getPane().appendChild(this._container);
    this.update();
    if (map._fadeAnimated) {
      setOpacity(this._container, 1);
    }
    this.bringToFront();
    if (this.options.interactive) {
      addClass(this._container, 'atlas-interactive');
      this.addInteractiveTarget(this._container);
    }
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    if (map._fadeAnimated) {
      setOpacity(this._container, 0);
      this._removeTimeout = setTimeout(bind(remove, undefined, this._container), 200);
    } else {
      remove(this._container);
    }
    if (this.options.interactive) {
      removeClass(this._container, 'atlas-interactive');
      this.removeInteractiveTarget(this._container);
    }
  },

  /**
   * Gets overlay position.
   * @return {!LatLng} Position.
   */
  getLatLng: function() {
    return this._latlng;
  },

  /**
   * Sets overlay position.
   * @param {!LatLng|number[]} latlng New position.
   * @return {!DivOverlay} This overlay.
   */
  setLatLng: function(latlng) {
    this._latlng = toLatLng(latlng);
    if (this._map) {
      this._updatePosition();
      this._adjustPan();
    }
    return this;
  },

  /**
   * Gets overlay content.
   * @return {*} Content.
   */
  getContent: function() {
    return this._content;
  },

  /**
   * Sets overlay content.
   * @param {*} content New content.
   * @return {!DivOverlay} This overlay.
   */
  setContent: function(content) {
    this._content = content;
    this.update();
    return this;
  },

  /**
   * Gets container element.
   * @return {Element} Container.
   */
  getElement: function() {
    return this._container;
  },

  /**
   * Updates overlay.
   * @return {!DivOverlay} This overlay.
   */
  update: function() {
    if (!this._map) {
      return;
    }
    this._container.style.visibility = 'hidden';
    this._updateContent();
    this._updateLayout();
    this._updatePosition();
    this._container.style.visibility = '';
    this._adjustPan();
    return this;
  },

  /**
   * Gets events handled by overlay.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = {
      zoom: this._updatePosition,
      viewreset: this._updatePosition,
    };
    if (this._zoomAnimated) {
      events.zoomanim = this._animateZoom;
    }
    return events;
  },

  /**
   * Checks if overlay is open.
   * @return {boolean} Whether open.
   */
  isOpen: function() {
    return !!this._map && this._map.hasLayer(this);
  },

  /**
   * Brings overlay to front.
   * @return {!DivOverlay} This overlay.
   */
  bringToFront: function() {
    if (this._map) {
      toFront(this._container);
    }
    return this;
  },

  /**
   * Brings overlay to back.
   * @return {!DivOverlay} This overlay.
   */
  bringToBack: function() {
    if (this._map) {
      toBack(this._container);
    }
    return this;
  },

  /**
   * Prepares overlay for opening.
   * @param {!LatLng|number[]=} latlng Position.
   * @return {boolean} Whether successful.
   * @private
   */
  _prepareOpen: function(latlng) {
    const source = this._source;
    if (!source._map) {
      return false;
    }
    if (source instanceof FeatureGroup) {
      let layers = this._source._layers;
      for (const id in layers) {
        if (layers[id]._map) {
          this._source = layers[id];
          break;
        }
      }
      if (!this._source) {
        return false;
      }
    }
    if (!latlng) {
      if (source.getCenter) {
        latlng = source.getCenter();
      } else if (source.getLatLng) {
        latlng = source.getLatLng();
      } else if (source.getBounds) {
        latlng = source.getBounds().getCenter();
      } else {
        throw new Error('Unable to get source layer LatLng.');
      }
    }
    this.setLatLng(latlng);
    if (this._map) {
      this.update();
    }
    return true;
  },

  /**
   * Updates content.
   * @private
   */
  _updateContent: function() {
    if (!this._content) {
      return;
    }
    const node = this._contentNode;
    const content = (typeof this._content === 'function') ?
        this._content(this._source || this) : this._content;
    if (typeof content === 'string') {
      node.innerHTML = content;
    } else {
      while (node.hasChildNodes()) {
        node.removeChild(node.firstChild);
      }
      node.appendChild(content);
    }
    this.fire('contentupdate');
  },

  /**
   * Updates position.
   * @private
   */
  _updatePosition: function() {
    if (!this._map) {
      return;
    }
    const pos = this._map.latLngToLayerPoint(this._latlng);
    const offset = toPoint(this.options.offset);
    const anchor = this._getAnchor();
    if (this._zoomAnimated) {
      setPosition(this._container, pos.add(anchor));
    } else {
      offset._add(pos)._add(anchor);
    }
    const bottom = this._containerBottom = -offset.y;
    const left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;
    this._container.style.bottom = bottom + 'px';
    this._container.style.left = left + 'px';
  },

  /**
   * Gets anchor point.
   * @return {Point} Anchor.
   * @private
   */
  _getAnchor: function() {
    return [0, 0];
  },
});

// Add overlay initialization to Map and Layer
Map.include({
  /**
   * Initializes overlay.
   * @param {!Function} OverlayClass Overlay constructor.
   * @param {*} content Content or existing overlay.
   * @param {!LatLng|number[]=} latlng Position.
   * @param {Object=} options Options.
   * @return {!DivOverlay} Overlay instance.
   * @private
   */
  _initOverlay: function(OverlayClass, content, latlng, options) {
    let overlay = content;
    if (!(overlay instanceof OverlayClass)) {
      overlay = new OverlayClass(options).setContent(content);
    }
    if (latlng) {
      overlay.setLatLng(latlng);
    }
    return overlay;
  },
});

Layer.include({
  /**
   * Initializes overlay for layer.
   * @param {!Function} OverlayClass Overlay constructor.
   * @param {DivOverlay=} old Existing overlay.
   * @param {*} content Content.
   * @param {Object=} options Options.
   * @return {!DivOverlay} Overlay instance.
   * @private
   */
  _initOverlay: function(OverlayClass, old, content, options) {
    let overlay = content;
    if (overlay instanceof OverlayClass) {
      setOptions(overlay, options);
      overlay._source = this;
    } else {
      overlay = (old && !options) ? old : new OverlayClass(options, this);
      overlay.setContent(content);
    }
    return overlay;
  },
});

/**
 * Popup overlay for displaying content.
 * @extends {DivOverlay}
 */
const Popup = DivOverlay.extend(/** @lends Popup.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    pane: 'popupPane',
    offset: [0, 7],
    maxWidth: 300,
    minWidth: 50,
    maxHeight: null,
    autoPan: true,
    autoPanPaddingTopLeft: null,
    autoPanPaddingBottomRight: null,
    autoPanPadding: [5, 5],
    keepInView: false,
    closeButton: true,
    autoClose: true,
    closeOnEscapeKey: true,
    className: '',
  },

  /**
   * Opens popup on map.
   * @param {Map=} map Map instance.
   * @return {!Popup} This popup.
   */
  openOn: function(map) {
    map = arguments.length ? map : this._source._map;
    if (!map.hasLayer(this) && map._popup && map._popup.options.autoClose) {
      map.removeLayer(map._popup);
    }
    map._popup = this;
    return DivOverlay.prototype.openOn.call(this, map);
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   */
  onAdd: function(map) {
    DivOverlay.prototype.onAdd.call(this, map);
    map.fire('popupopen', {popup: this});
    if (this._source) {
      this._source.fire('popupopen', {popup: this}, true);
      if (!(this._source instanceof Path)) {
        this._source.on('preclick', stopPropagation);
      }
    }
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    DivOverlay.prototype.onRemove.call(this, map);
    map.fire('popupclose', {popup: this});
    if (this._source) {
      this._source.fire('popupclose', {popup: this}, true);
      if (!(this._source instanceof Path)) {
        this._source.off('preclick', stopPropagation);
      }
    }
  },

  /**
   * Gets events handled by popup.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = DivOverlay.prototype.getEvents.call(this);
    const closeOnClick = this.options.closeOnClick !== undefined ?
        this.options.closeOnClick : this._map.options.closePopupOnClick;
    if (closeOnClick) {
      events.preclick = this.close;
    }
    if (this.options.keepInView) {
      events.moveend = this._adjustPan;
    }
    return events;
  },

  /**
   * Initializes popup layout.
   * @private
   */
  _initLayout: function() {
    const prefix = 'atlas-popup';
    const container = this._container = create$1('div',
        prefix + ' ' + (this.options.className || '') + ' atlas-zoom-animated');
    const wrapper = this._wrapper = create$1('div', prefix + '-content-wrapper', container);
    this._contentNode = create$1('div', prefix + '-content', wrapper);
    disableClickPropagation(container);
    disableScrollPropagation(this._contentNode);
    on(container, 'contextmenu', stopPropagation);
    this._tipContainer = create$1('div', prefix + '-tip-container', container);
    this._tip = create$1('div', prefix + '-tip', this._tipContainer);
    if (this.options.closeButton) {
      const closeButton = this._closeButton = create$1('a', prefix + '-close-button', container);
      closeButton.setAttribute('role', 'button');
      closeButton.setAttribute('aria-label', 'Close popup');
      closeButton.href = '#close';
      closeButton.innerHTML = '<span aria-hidden="true">&#215;</span>';
      on(closeButton, 'click', function(ev) {
        preventDefault(ev);
        this.close();
      }, this);
    }
  },

  /**
   * Updates popup layout.
   * @private
   */
  _updateLayout: function() {
    const container = this._contentNode;
    const style = container.style;
    style.width = '';
    style.whiteSpace = 'nowrap';
    let width = container.offsetWidth;
    width = Math.min(width, this.options.maxWidth);
    width = Math.max(width, this.options.minWidth);
    style.width = (width + 1) + 'px';
    style.whiteSpace = '';
    style.height = '';
    const height = container.offsetHeight;
    const maxHeight = this.options.maxHeight;
    const scrolledClass = 'atlas-popup-scrolled';
    if (maxHeight && height > maxHeight) {
      style.height = maxHeight + 'px';
      addClass(container, scrolledClass);
    } else {
      removeClass(container, scrolledClass);
    }
    this._containerWidth = this._container.offsetWidth;
  },

  /**
   * Animates zoom.
   * @param {!Object} e Zoom event.
   * @private
   */
  _animateZoom: function(e) {
    const pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
    const anchor = this._getAnchor();
    setPosition(this._container, pos.add(anchor));
  },

  /**
   * Adjusts pan to keep popup in view.
   * @private
   */
  _adjustPan: function() {
    if (!this.options.autoPan) {
      return;
    }
    if (this._map._panAnim) {
      this._map._panAnim.stop();
    }
    if (this._autopanning) {
      this._autopanning = false;
      return;
    }
    const map = this._map;
    const marginBottom = parseInt(getStyle(this._container, 'marginBottom'), 10) || 0;
    const containerHeight = this._container.offsetHeight + marginBottom;
    const containerWidth = this._containerWidth;
    const layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);
    layerPos._add(getPosition(this._container));
    const containerPos = map.layerPointToContainerPoint(layerPos);
    const padding = toPoint(this.options.autoPanPadding);
    const paddingTL = toPoint(this.options.autoPanPaddingTopLeft || padding);
    const paddingBR = toPoint(this.options.autoPanPaddingBottomRight || padding);
    const size = map.getSize();
    let dx = 0;
    let dy = 0;
    if (containerPos.x + containerWidth + paddingBR.x > size.x) {
      dx = containerPos.x + containerWidth - size.x + paddingBR.x;
    }
    if (containerPos.x - dx - paddingTL.x < 0) {
      dx = containerPos.x - paddingTL.x;
    }
    if (containerPos.y + containerHeight + paddingBR.y > size.y) {
      dy = containerPos.y + containerHeight - size.y + paddingBR.y;
    }
    if (containerPos.y - dy - paddingTL.y < 0) {
      dy = containerPos.y - paddingTL.y;
    }
    if (dx || dy) {
      if (this.options.keepInView) {
        this._autopanning = true;
      }
      map
          .fire('autopanstart')
          .panBy([dx, dy]);
    }
  },

  /**
   * Gets popup anchor.
   * @return {!Point} Anchor point.
   * @private
   */
  _getAnchor: function() {
    return toPoint(this._source && this._source._getPopupAnchor ?
        this._source._getPopupAnchor() : [0, 0]);
  },
});

/**
 * Creates a popup.
 * @param {Object=} options Popup options.
 * @param {Layer=} source Source layer.
 * @return {!Popup} New popup.
 */
function popup(options, source) {
  return new Popup(options, source);
}

// Add popup options to Map
Map.mergeOptions({
  closePopupOnClick: true,
});

// Add popup methods to Map
Map.include({
  /**
   * Opens popup.
   * @param {Popup|string|Element} popup Popup or content.
   * @param {!LatLng|number[]=} latlng Position.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  openPopup: function(popup, latlng, options) {
    this._initOverlay(Popup, popup, latlng, options).openOn(this);
    return this;
  },

  /**
   * Closes popup.
   * @param {Popup=} popup Popup to close.
   * @return {!Map} This map.
   */
  closePopup: function(popup) {
    popup = arguments.length ? popup : this._popup;
    if (popup) {
      popup.close();
    }
    return this;
  },
});

// Add popup methods to Layer
Layer.include({
  /**
   * Binds popup to layer.
   * @param {Popup|string|Element} content Popup or content.
   * @param {Object=} options Options.
   * @return {!Layer} This layer.
   */
  bindPopup: function(content, options) {
    this._popup = this._initOverlay(Popup, this._popup, content, options);
    if (!this._popupHandlersAdded) {
      this.on({
        click: this._openPopup,
        keypress: this._onKeyPress,
        remove: this.closePopup,
        move: this._movePopup,
      });
      this._popupHandlersAdded = true;
    }
    return this;
  },

  /**
   * Unbinds popup from layer.
   * @return {!Layer} This layer.
   */
  unbindPopup: function() {
    if (this._popup) {
      this.off({
        click: this._openPopup,
        keypress: this._onKeyPress,
        remove: this.closePopup,
        move: this._movePopup,
      });
      this._popupHandlersAdded = false;
      this._popup = null;
    }
    return this;
  },

  /**
   * Opens popup.
   * @param {!LatLng|number[]=} latlng Position.
   * @return {!Layer} This layer.
   */
  openPopup: function(latlng) {
    if (this._popup) {
      if (!(this instanceof FeatureGroup)) {
        this._popup._source = this;
      }
      if (this._popup._prepareOpen(latlng || this._latlng)) {
        this._popup.openOn(this._map);
      }
    }
    return this;
  },

  /**
   * Closes popup.
   * @return {!Layer} This layer.
   */
  closePopup: function() {
    if (this._popup) {
      this._popup.close();
    }
    return this;
  },

  /**
   * Toggles popup.
   * @return {!Layer} This layer.
   */
  togglePopup: function() {
    if (this._popup) {
      this._popup.toggle(this);
    }
    return this;
  },

  /**
   * Checks if popup is open.
   * @return {boolean} Whether open.
   */
  isPopupOpen: function() {
    return (this._popup ? this._popup.isOpen() : false);
  },

  /**
   * Sets popup content.
   * @param {string|Element} content New content.
   * @return {!Layer} This layer.
   */
  setPopupContent: function(content) {
    if (this._popup) {
      this._popup.setContent(content);
    }
    return this;
  },

  /**
   * Gets popup.
   * @return {Popup|undefined} Popup.
   */
  getPopup: function() {
    return this._popup;
  },

  /**
   * Opens popup on click.
   * @param {!Object} e Event.
   * @private
   */
  _openPopup: function(e) {
    if (!this._popup || !this._map) {
      return;
    }
    stop(e);
    const target = e.layer || e.target;
    if (this._popup._source === target && !(target instanceof Path)) {
      if (this._map.hasLayer(this._popup)) {
        this.closePopup();
      } else {
        this.openPopup(e.latlng);
      }
      return;
    }
    this._popup._source = target;
    this.openPopup(e.latlng);
  },

  /**
   * Moves popup with layer.
   * @param {!Object} e Event.
   * @private
   */
  _movePopup: function(e) {
    this._popup.setLatLng(e.latlng);
  },

  /**
   * Opens popup on Enter key.
   * @param {!Object} e Event.
   * @private
   */
  _onKeyPress: function(e) {
    if (e.originalEvent.keyCode === 13) {
      this._openPopup(e);
    }
  },
});

/**
 * Tooltip overlay for displaying short text.
 * @extends {DivOverlay}
 */
const Tooltip = DivOverlay.extend(/** @lends Tooltip.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    pane: 'tooltipPane',
    offset: [0, 0],
    direction: 'auto',
    permanent: false,
    sticky: false,
    opacity: 0.9,
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   */
  onAdd: function(map) {
    DivOverlay.prototype.onAdd.call(this, map);
    this.setOpacity(this.options.opacity);
    map.fire('tooltipopen', {tooltip: this});
    if (this._source) {
      this.addEventParent(this._source);
      this._source.fire('tooltipopen', {tooltip: this}, true);
    }
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    DivOverlay.prototype.onRemove.call(this, map);
    map.fire('tooltipclose', {tooltip: this});
    if (this._source) {
      this.removeEventParent(this._source);
      this._source.fire('tooltipclose', {tooltip: this}, true);
    }
  },

  /**
   * Gets events handled by tooltip.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = DivOverlay.prototype.getEvents.call(this);
    if (!this.options.permanent) {
      events.preclick = this.close;
    }
    return events;
  },

  /**
   * Initializes tooltip layout.
   * @private
   */
  _initLayout: function() {
    const prefix = 'atlas-tooltip';
    const className = prefix + ' ' + (this.options.className || '') +
        ' atlas-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');
    this._contentNode = this._container = create$1('div', className);
    this._container.setAttribute('role', 'tooltip');
    this._container.setAttribute('id', 'atlas-tooltip-' + stamp(this));
  },

  /**
   * Updates layout (empty for tooltips).
   * @private
   */
  _updateLayout: function() {},

  /**
   * Adjusts pan (empty for tooltips).
   * @private
   */
  _adjustPan: function() {},

  /**
   * Sets tooltip position.
   * @param {!Point} pos Position.
   * @private
   */
  _setPosition: function(pos) {
    let subX, subY;
    const map = this._map;
    const container = this._container;
    const centerPoint = map.latLngToContainerPoint(map.getCenter());
    const tooltipPoint = map.layerPointToContainerPoint(pos);
    let direction = this.options.direction;
    const tooltipWidth = container.offsetWidth;
    const tooltipHeight = container.offsetHeight;
    const offset = toPoint(this.options.offset);
    const anchor = this._getAnchor();

    if (direction === 'top') {
      subX = tooltipWidth / 2;
      subY = tooltipHeight;
    } else if (direction === 'bottom') {
      subX = tooltipWidth / 2;
      subY = 0;
    } else if (direction === 'center') {
      subX = tooltipWidth / 2;
      subY = tooltipHeight / 2;
    } else if (direction === 'right') {
      subX = 0;
      subY = tooltipHeight / 2;
    } else if (direction === 'left') {
      subX = tooltipWidth;
      subY = tooltipHeight / 2;
    } else if (tooltipPoint.x < centerPoint.x) {
      direction = 'right';
      subX = 0;
      subY = tooltipHeight / 2;
    } else {
      direction = 'left';
      subX = tooltipWidth + (offset.x + anchor.x) * 2;
      subY = tooltipHeight / 2;
    }

    pos = pos.subtract(toPoint(subX, subY, true)).add(offset).add(anchor);
    removeClass(container, 'atlas-tooltip-right');
    removeClass(container, 'atlas-tooltip-left');
    removeClass(container, 'atlas-tooltip-top');
    removeClass(container, 'atlas-tooltip-bottom');
    addClass(container, 'atlas-tooltip-' + direction);
    setPosition(container, pos);
  },

  /**
   * Updates tooltip position.
   * @private
   */
  _updatePosition: function() {
    const pos = this._map.latLngToLayerPoint(this._latlng);
    this._setPosition(pos);
  },

  /**
   * Sets tooltip opacity.
   * @param {number} opacity Opacity value (0–1).
   * @return {!Tooltip} This tooltip.
   */
  setOpacity: function(opacity) {
    this.options.opacity = opacity;
    if (this._container) {
      setOpacity(this._container, opacity);
    }
    return this;
  },

  /**
   * Animates zoom.
   * @param {!Object} e Zoom event.
   * @private
   */
  _animateZoom: function(e) {
    const pos = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center);
    this._setPosition(pos);
  },

  /**
   * Gets tooltip anchor.
   * @return {!Point} Anchor point.
   * @private
   */
  _getAnchor: function() {
    return toPoint(this._source && this._source._getTooltipAnchor && !this.options.sticky ?
        this._source._getTooltipAnchor() : [0, 0]);
  },
});

/**
 * Creates a tooltip.
 * @param {Object=} options Tooltip options.
 * @param {Layer=} source Source layer.
 * @return {!Tooltip} New tooltip.
 */
function tooltip(options, source) {
  return new Tooltip(options, source);
}

// Add tooltip methods to Map
Map.include({
  /**
   * Opens tooltip.
   * @param {Tooltip|string|Element} tooltip Tooltip or content.
   * @param {!LatLng|number[]=} latlng Position.
   * @param {Object=} options Options.
   * @return {!Map} This map.
   */
  openTooltip: function(tooltip, latlng, options) {
    this._initOverlay(Tooltip, tooltip, latlng, options).openOn(this);
    return this;
  },

  /**
   * Closes tooltip.
   * @param {Tooltip} tooltip Tooltip to close.
   * @return {!Map} This map.
   */
  closeTooltip: function(tooltip) {
    tooltip.close();
    return this;
  },
});

// Add tooltip methods to Layer
Layer.include({
  /**
   * Binds tooltip to layer.
   * @param {Tooltip|string|Element} content Tooltip or content.
   * @param {Object=} options Options.
   * @return {!Layer} This layer.
   */
  bindTooltip: function(content, options) {
    if (this._tooltip && this.isTooltipOpen()) {
      this.unbindTooltip();
    }
    this._tooltip = this._initOverlay(Tooltip, this._tooltip, content, options);
    this._initTooltipInteractions();
    if (this._tooltip.options.permanent && this._map && this._map.hasLayer(this)) {
      this.openTooltip();
    }
    return this;
  },

  /**
   * Unbinds tooltip from layer.
   * @return {!Layer} This layer.
   */
  unbindTooltip: function() {
    if (this._tooltip) {
      this._initTooltipInteractions(true);
      this.closeTooltip();
      this._tooltip = null;
    }
    return this;
  },

  /**
   * Initializes tooltip interactions.
   * @param {boolean=} remove Whether to remove handlers.
   * @private
   */
  _initTooltipInteractions: function(remove) {
    if (!remove && this._tooltipHandlersAdded) {
      return;
    }
    const onOff = remove ? 'off' : 'on';
    const events = {
      remove: this.closeTooltip,
      move: this._moveTooltip,
    };
    if (!this._tooltip.options.permanent) {
      events.mouseover = this._openTooltip;
      events.mouseout = this.closeTooltip;
      events.click = this._openTooltip;
      if (this._map) {
        this._addFocusListeners();
      } else {
        events.add = this._addFocusListeners;
      }
    } else {
      events.add = this._openTooltip;
    }
    if (this._tooltip.options.sticky) {
      events.mousemove = this._moveTooltip;
    }
    this[onOff](events);
    this._tooltipHandlersAdded = !remove;
  },

  /**
   * Opens tooltip.
   * @param {!LatLng|number[]=} latlng Position.
   * @return {!Layer} This layer.
   */
  openTooltip: function(latlng) {
    if (this._tooltip) {
      if (!(this instanceof FeatureGroup)) {
        this._tooltip._source = this;
      }
      if (this._tooltip._prepareOpen(latlng)) {
        this._tooltip.openOn(this._map);
        if (this.getElement) {
          this._setAriaDescribedByOnLayer(this);
        } else if (this.eachLayer) {
          this.eachLayer(this._setAriaDescribedByOnLayer, this);
        }
      }
    }
    return this;
  },

  /**
   * Closes tooltip.
   * @return {Tooltip|undefined} Closed tooltip.
   */
  closeTooltip: function() {
    if (this._tooltip) {
      return this._tooltip.close();
    }
  },

  /**
   * Toggles tooltip.
   * @return {!Layer} This layer.
   */
  toggleTooltip: function() {
    if (this._tooltip) {
      this._tooltip.toggle(this);
    }
    return this;
  },

  /**
   * Checks if tooltip is open.
   * @return {boolean} Whether open.
   */
  isTooltipOpen: function() {
    return this._tooltip.isOpen();
  },

  /**
   * Sets tooltip content.
   * @param {string|Element} content New content.
   * @return {!Layer} This layer.
   */
  setTooltipContent: function(content) {
    if (this._tooltip) {
      this._tooltip.setContent(content);
    }
    return this;
  },

  /**
   * Gets tooltip.
   * @return {Tooltip|undefined} Tooltip.
   */
  getTooltip: function() {
    return this._tooltip;
  },

  /**
   * Adds focus listeners for accessibility.
   * @private
   */
  _addFocusListeners: function() {
    if (this.getElement) {
      this._addFocusListenersOnLayer(this);
    } else if (this.eachLayer) {
      this.eachLayer(this._addFocusListenersOnLayer, this);
    }
  },

  /**
   * Adds focus listeners to layer element.
   * @param {!Layer} layer Layer.
   * @private
   */
  _addFocusListenersOnLayer: function(layer) {
    const el = typeof layer.getElement === 'function' && layer.getElement();
    if (el) {
      on(el, 'focus', function() {
        this._tooltip._source = layer;
        this.openTooltip();
      }, this);
      on(el, 'blur', this.closeTooltip, this);
    }
  },

  /**
   * Sets aria-describedby for accessibility.
   * @param {!Layer} layer Layer.
   * @private
   */
  _setAriaDescribedByOnLayer: function(layer) {
    const el = typeof layer.getElement === 'function' && layer.getElement();
    if (el) {
      el.setAttribute('aria-describedby', this._tooltip._container.id);
    }
  },

  /**
   * Opens tooltip on interaction.
   * @param {!Object} e Event.
   * @private
   */
  _openTooltip: function(e) {
    if (!this._tooltip || !this._map) {
      return;
    }
    if (this._map.dragging && this._map.dragging.moving() && !this._openOnceFlag) {
      this._openOnceFlag = true;
      const that = this;
      this._map.once('moveend', function() {
        that._openOnceFlag = false;
        that._openTooltip(e);
      });
      return;
    }
    this._tooltip._source = e.layer || e.target;
    this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
  },

  /**
   * Moves tooltip (for sticky mode).
   * @param {!Object} e Event.
   * @private
   */
  _moveTooltip: function(e) {
    let latlng = e.latlng;
    let containerPoint;
    let layerPoint;
    if (this._tooltip.options.sticky && e.originalEvent) {
      containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
      layerPoint = this._map.containerPointToLayerPoint(containerPoint);
      latlng = this._map.layerPointToLatLng(layerPoint);
    }
    this._tooltip.setLatLng(latlng);
  },
});
