/**
 * Base icon class.
 */
class Icon {
  /**
   * @param {Object=} options Icon options.
   */
  constructor(options) {
    this.options = Object.create(this.constructor.prototype.options);
    for (const i in options) {
      this.options[i] = options[i];
    }
  }

  /**
   * Creates icon element.
   * @param {Element=} oldIcon Existing icon element.
   * @return {!Element} Created icon element.
   */
  createIcon(oldIcon) {
    return this._createIcon('icon', oldIcon);
  }

  /**
   * Creates shadow element.
   * @param {Element=} oldIcon Existing shadow element.
   * @return {Element} Created shadow element.
   */
  createShadow(oldIcon) {
    return this._createIcon('shadow', oldIcon);
  }

  /**
   * Creates icon or shadow element.
   * @param {string} name Element type ('icon' or 'shadow').
   * @param {Element=} oldIcon Existing element.
   * @return {!Element} Created element.
   * @private
   */
  _createIcon(name, oldIcon) {
    const src = this._getIconUrl(name);
    if (!src) {
      if (name === 'icon') {
        throw new Error('iconUrl not set in Icon options (see the docs).');
      }
      return null;
    }
    const img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
    this._setIconStyles(img, name);
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    return img;
  }

  /**
   * Sets icon styles.
   * @param {!Element} img Image element.
   * @param {string} name Element type.
   * @private
   */
  _setIconStyles(img, name) {
    const options = this.options;
    let sizeOption = options[name + 'Size'];
    if (typeof sizeOption === 'number') {
      sizeOption = [sizeOption, sizeOption];
    }
    const size = toPoint(sizeOption);
    const anchor = toPoint((name === 'shadow' && options.shadowAnchor) ||
        options.iconAnchor || (size && size.divideBy(2, true)));
    img.className = 'atlas-marker-' + name + ' ' + (options.className || '');
    if (anchor) {
      img.style.marginLeft = (-anchor.x) + 'px';
      img.style.marginTop = (-anchor.y) + 'px';
    }
    if (size) {
      img.style.width = size.x + 'px';
      img.style.height = size.y + 'px';
    }
  }

  /**
   * Creates image element.
   * @param {string} src Image source.
   * @param {Element=} el Existing element.
   * @return {!Element} Image element.
   * @private
   */
  _createImg(src, el) {
    el = el || document.createElement('img');
    el.src = src;
    return el;
  }

  /**
   * Gets icon URL.
   * @param {string} name Element type.
   * @return {string} URL.
   * @private
   */
  _getIconUrl(name) {
    return Browser.retina && this.options[name + 'RetinaUrl'] ||
        this.options[name + 'Url'];
  }
}

Icon.prototype.options = {
  popupAnchor: [0, 0],
  tooltipAnchor: [0, 0],
  crossOrigin: false,
};

/**
 * Creates an icon.
 * @param {Object=} options Icon options.
 * @return {!Icon} New icon.
 */
function icon(options) {
  return new Icon(options);
}

/**
 * Default icon implementation.
 * @extends {Icon}
 */
class IconDefault extends Icon {
  /**
   * Gets icon URL with automatic path detection.
   * @param {string} name Element type.
   * @return {string} URL.
   * @private
   */
  _getIconUrl(name) {
    if (typeof IconDefault.imagePath !== 'string') {
      IconDefault.imagePath = this._detectIconPath();
    }
    return (this.options.imagePath || IconDefault.imagePath) + super._getIconUrl(name);
  }

  /**
   * Strips URL from CSS background property.
   * @param {string} path CSS path.
   * @return {string} Clean path.
   * @private
   */
  _stripUrl(path) {
    const strip = function(str, re, idx) {
      const match = re.exec(str);
      return match && match[idx];
    };
    path = strip(path, /^url\((['"])?(.+)\1\)$/, 2);
    return path && strip(path, /^(.*)marker-icon\.png$/, 1);
  }

  /**
   * Detects icon path from CSS.
   * @return {string} Detected path.
   * @private
   */
  _detectIconPath() {
    const el = create$1('div', 'atlas-default-icon-path', document.body);
    let path = getStyle(el, 'background-image') ||
        getStyle(el, 'backgroundImage'); // IE8
    document.body.removeChild(el);
    path = this._stripUrl(path);
    if (path) {
      return path;
    }
    const link = document.querySelector('link[href$="atlas.css"]');
    if (!link) {
      return '';
    }
    return link.href.substring(0, link.href.length - 'atlas.css'.length) + 'images/';
  }
}

IconDefault.prototype.options = Object.create(Icon.prototype.options);
Object.assign(IconDefault.prototype.options, {
  iconUrl: 'marker-icon.png',
  iconRetinaUrl: 'marker-icon-2x.png',
  shadowUrl: 'marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

/**
 * Marker dragging handler.
 * @extends {Handler}
 */
const MarkerDrag = Handler.extend(/** @lends MarkerDrag.prototype */ {
  /**
   * @param {!Marker} marker Marker instance.
   */
  initialize: function(marker) {
    this._marker = marker;
  },

  /**
   * Adds dragging hooks.
   */
  addHooks: function() {
    const icon = this._marker._icon;
    if (!this._draggable) {
      this._draggable = new Draggable(icon, icon, true);
    }
    this._draggable.on({
      dragstart: this._onDragStart,
      predrag: this._onPreDrag,
      drag: this._onDrag,
      dragend: this._onDragEnd,
    }, this).enable();
    addClass(icon, 'atlas-marker-draggable');
  },

  /**
   * Removes dragging hooks.
   */
  removeHooks: function() {
    this._draggable.off({
      dragstart: this._onDragStart,
      predrag: this._onPreDrag,
      drag: this._onDrag,
      dragend: this._onDragEnd,
    }, this).disable();
    if (this._marker._icon) {
      removeClass(this._marker._icon, 'atlas-marker-draggable');
    }
  },

  /**
   * Checks if marker was moved.
   * @return {boolean} Whether moved.
   */
  moved: function() {
    return this._draggable && this._draggable._moved;
  },

  /**
   * Adjusts map pan during drag.
   * @param {!Object} e Drag event.
   * @private
   */
  _adjustPan: function(e) {
    const marker = this._marker;
    const map = marker._map;
    const speed = this._marker.options.autoPanSpeed;
    const padding = this._marker.options.autoPanPadding;
    const iconPos = getPosition(marker._icon);
    const bounds = map.getPixelBounds();
    const origin = map.getPixelOrigin();
    const panBounds = toBounds(
        bounds.min._subtract(origin).add(padding),
        bounds.max._subtract(origin).subtract(padding));
    if (!panBounds.contains(iconPos)) {
      const movement = toPoint(
          (Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) /
              (bounds.max.x - panBounds.max.x) -
          (Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) /
              (bounds.min.x - panBounds.min.x),
          (Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) /
              (bounds.max.y - panBounds.max.y) -
          (Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) /
              (bounds.min.y - panBounds.min.y))
          .multiplyBy(speed);
      map.panBy(movement, {animate: false});
      this._draggable._newPos._add(movement);
      this._draggable._startPos._add(movement);
      setPosition(marker._icon, this._draggable._newPos);
      this._onDrag(e);
      this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
    }
  },

  /**
   * Handles drag start.
   * @private
   */
  _onDragStart: function() {
    this._oldLatLng = this._marker.getLatLng();
    this._marker.closePopup && this._marker.closePopup();
    this._marker
        .fire('movestart')
        .fire('dragstart');
  },

  /**
   * Handles pre-drag (for auto-pan).
   * @param {!Object} e Drag event.
   * @private
   */
  _onPreDrag: function(e) {
    if (this._marker.options.autoPan) {
      cancelAnimFrame(this._panRequest);
      this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
    }
  },

  /**
   * Handles drag.
   * @param {!Object} e Drag event.
   * @private
   */
  _onDrag: function(e) {
    const marker = this._marker;
    const shadow = marker._shadow;
    const iconPos = getPosition(marker._icon);
    const latlng = marker._map.layerPointToLatLng(iconPos);
    if (shadow) {
      setPosition(shadow, iconPos);
    }
    marker._latlng = latlng;
    e.latlng = latlng;
    e.oldLatLng = this._oldLatLng;
    marker
        .fire('move', e)
        .fire('drag', e);
  },

  /**
   * Handles drag end.
   * @param {!Object} e Drag event.
   * @private
   */
  _onDragEnd: function(e) {
    cancelAnimFrame(this._panRequest);
    delete this._oldLatLng;
    this._marker
        .fire('moveend')
        .fire('dragend', e);
  },
});

/**
 * Marker class for displaying icons on the map.
 * @extends {Layer}
 */
const Marker = Layer.extend(/** @lends Marker.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    icon: new IconDefault(),
    interactive: true,
    keyboard: true,
    title: '',
    alt: 'Marker',
    zIndexOffset: 0,
    opacity: 1,
    riseOnHover: false,
    riseOffset: 250,
    pane: 'markerPane',
    shadowPane: 'shadowPane',
    bubblingMouseEvents: false,
    autoPanOnFocus: true,
    draggable: false,
    autoPan: false,
    autoPanPadding: [50, 50],
    autoPanSpeed: 10,
  },

  /**
   * @param {!LatLng|number[]} latlng Latitude/longitude.
   * @param {Object=} options Marker options.
   */
  initialize: function(latlng, options) {
    setOptions(this, options);
    this._latlng = toLatLng(latlng);
  },

  /**
   * Called when added to map.
   */
  onAdd: function(map) {
    this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;
    if (this._zoomAnimated) {
      map.on('zoomanim', this._animateZoom, this);
    }
    this._initIcon();
    this.update();
  },

  /**
   * Called when removed from map.
   */
  onRemove: function(map) {
    if (this.dragging && this.dragging.enabled()) {
      this.options.draggable = true;
      this.dragging.removeHooks();
    }
    delete this.dragging;
    if (this._zoomAnimated) {
      map.off('zoomanim', this._animateZoom, this);
    }
    this._removeIcon();
    this._removeShadow();
  },

  /**
   * Gets events handled by marker.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    return {
      zoom: this.update,
      viewreset: this.update,
    };
  },

  /**
   * Gets marker position.
   * @return {!LatLng} Position.
   */
  getLatLng: function() {
    return this._latlng;
  },

  /**
   * Sets marker position.
   * @param {!LatLng|number[]} latlng New position.
   * @return {!Marker} This marker.
   */
  setLatLng: function(latlng) {
    const oldLatLng = this._latlng;
    this._latlng = toLatLng(latlng);
    this.update();
    return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
  },

  /**
   * Sets z-index offset.
   * @param {number} offset Z-index offset.
   * @return {!Marker} This marker.
   */
  setZIndexOffset: function(offset) {
    this.options.zIndexOffset = offset;
    return this.update();
  },

  /**
   * Gets marker icon.
   * @return {!Icon} Icon.
   */
  getIcon: function() {
    return this.options.icon;
  },

  /**
   * Sets marker icon.
   * @param {!Icon} icon New icon.
   * @return {!Marker} This marker.
   */
  setIcon: function(icon) {
    this.options.icon = icon;
    if (this._map) {
      this._initIcon();
      this.update();
    }
    if (this._popup) {
      this.bindPopup(this._popup, this._popup.options);
    }
    return this;
  },

  /**
   * Gets marker element.
   * @return {Element} Element.
   */
  getElement: function() {
    return this._icon;
  },

  /**
   * Updates marker position.
   * @return {!Marker} This marker.
   */
  update: function() {
    if (this._icon && this._map) {
      const pos = this._map.latLngToLayerPoint(this._latlng).round();
      this._setPos(pos);
    }
    return this;
  },

  /**
   * Initializes icon elements.
   * @private
   */
  _initIcon: function() {
    const options = this.options;
    const classToAdd = 'atlas-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');
    const icon = options.icon.createIcon(this._icon);
    let addIcon = false;
    if (icon !== this._icon) {
      if (this._icon) {
        this._removeIcon();
      }
      addIcon = true;
      if (options.title) {
        icon.title = options.title;
      }
      if (icon.tagName === 'IMG') {
        icon.alt = options.alt || '';
      }
    }
    addClass(icon, classToAdd);
    if (options.keyboard) {
      icon.tabIndex = '0';
      icon.setAttribute('role', 'button');
    }
    this._icon = icon;
    if (options.riseOnHover) {
      this.on({
        mouseover: this._bringToFront,
        mouseout: this._resetZIndex,
      });
    }
    if (this.options.autoPanOnFocus) {
      on(icon, 'focus', this._panOnFocus, this);
    }
    const newShadow = options.icon.createShadow(this._shadow);
    let addShadow = false;
    if (newShadow !== this._shadow) {
      this._removeShadow();
      addShadow = true;
    }
    if (newShadow) {
      addClass(newShadow, classToAdd);
      newShadow.alt = '';
    }
    this._shadow = newShadow;
    if (options.opacity < 1) {
      this._updateOpacity();
    }
    if (addIcon) {
      this.getPane().appendChild(this._icon);
    }
    this._initInteraction();
    if (newShadow && addShadow) {
      this.getPane(options.shadowPane).appendChild(this._shadow);
    }
  },

  /**
   * Removes icon element.
   * @private
   */
  _removeIcon: function() {
    if (this.options.riseOnHover) {
      this.off({
        mouseover: this._bringToFront,
        mouseout: this._resetZIndex,
      });
    }
    if (this.options.autoPanOnFocus) {
      off(this._icon, 'focus', this._panOnFocus, this);
    }
    remove(this._icon);
    this.removeInteractiveTarget(this._icon);
    this._icon = null;
  },

  /**
   * Removes shadow element.
   * @private
   */
  _removeShadow: function() {
    if (this._shadow) {
      remove(this._shadow);
    }
    this._shadow = null;
  },

  /**
   * Sets position of icon and shadow.
   * @param {!Point} pos Position.
   * @private
   */
  _setPos: function(pos) {
    if (this._icon) {
      setPosition(this._icon, pos);
    }
    if (this._shadow) {
      setPosition(this._shadow, pos);
    }
    this._zIndex = pos.y + this.options.zIndexOffset;
    this._resetZIndex();
  },

  /**
   * Updates z-index.
   * @param {number} offset Z-index offset.
   * @private
   */
  _updateZIndex: function(offset) {
    if (this._icon) {
      this._icon.style.zIndex = this._zIndex + offset;
    }
  },

  /**
   * Animates zoom.
   * @param {!Object} opt Zoom event.
   * @private
   */
  _animateZoom: function(opt) {
    const pos = this._map._latLngToNewLayerPoint(
        this._latlng, opt.zoom, opt.center).round();
    this._setPos(pos);
  },

  /**
   * Initializes interaction handlers.
   * @private
   */
  _initInteraction: function() {
    if (!this.options.interactive) {
      return;
    }
    addClass(this._icon, 'atlas-interactive');
    this.addInteractiveTarget(this._icon);
    if (MarkerDrag) {
      const draggable = this.options.draggable;
      if (this.dragging) {
        draggable = this.dragging.enabled();
        this.dragging.disable();
      }
      this.dragging = new MarkerDrag(this);
      if (draggable) {
        this.dragging.enable();
      }
    }
  },

  /**
   * Sets marker opacity.
   * @param {number} opacity Opacity value (0–1).
   * @return {!Marker} This marker.
   */
  setOpacity: function(opacity) {
    this.options.opacity = opacity;
    if (this._map) {
      this._updateOpacity();
    }
    return this;
  },

  /**
   * Updates opacity of icon and shadow.
   * @private
   */
  _updateOpacity: function() {
    const opacity = this.options.opacity;
    if (this._icon) {
      setOpacity(this._icon, opacity);
    }
    if (this._shadow) {
      setOpacity(this._shadow, opacity);
    }
  },

  /**
   * Brings marker to front.
   * @private
   */
  _bringToFront: function() {
    this._updateZIndex(this.options.riseOffset);
  },

  /**
   * Resets z-index to default.
   * @private
   */
  _resetZIndex: function() {
    this._updateZIndex(0);
  },

  /**
   * Pans map to keep marker in view when focused.
   * @private
   */
  _panOnFocus: function() {
    const map = this._map;
    if (!map) {
      return;
    }
    const iconOpts = this.options.icon.options;
    const size = iconOpts.iconSize ? toPoint(iconOpts.iconSize) : toPoint(0, 0);
    const anchor = iconOpts.iconAnchor ? toPoint(iconOpts.iconAnchor) : toPoint(0, 0);
    map.panInside(this._latlng, {
      paddingTopLeft: anchor,
      paddingBottomRight: size.subtract(anchor),
    });
  },

  /**
   * Gets popup anchor point.
   * @return {Point} Anchor point.
   * @private
   */
  _getPopupAnchor: function() {
    return this.options.icon.options.popupAnchor;
  },

  /**
   * Gets tooltip anchor point.
   * @return {Point} Anchor point.
   * @private
   */
  _getTooltipAnchor: function() {
    return this.options.icon.options.tooltipAnchor;
  },
});

/**
 * Creates a marker.
 * @param {!LatLng|number[]} latlng Latitude/longitude.
 * @param {Object=} options Marker options.
 * @return {!Marker} New marker.
 */
function marker(latlng, options) {
  return new Marker(latlng, options);
}

// Export Icon classes
Icon.Default = IconDefault;
