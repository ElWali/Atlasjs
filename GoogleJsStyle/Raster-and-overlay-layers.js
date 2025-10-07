/**
 * Overlays an image on the map.
 * @extends {Layer}
 */
const ImageOverlay = Layer.extend(/** @lends ImageOverlay.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    opacity: 1,
    alt: '',
    interactive: false,
    crossOrigin: false,
    errorOverlayUrl: '',
    zIndex: 1,
    className: '',
  },

  /**
   * @param {string|Element} url Image URL or element.
   * @param {!LatLngBounds|LatLng[]} bounds Image bounds.
   * @param {Object=} options Options.
   */
  initialize: function(url, bounds, options) {
    this._url = url;
    this._bounds = toLatLngBounds(bounds);
    setOptions(this, options);
  },

  /**
   * Called when added to map.
   */
  onAdd: function() {
    if (!this._image) {
      this._initImage();
      if (this.options.opacity < 1) {
        this._updateOpacity();
      }
    }
    if (this.options.interactive) {
      addClass(this._image, 'atlas-interactive');
      this.addInteractiveTarget(this._image);
    }
    this.getPane().appendChild(this._image);
    this._reset();
  },

  /**
   * Called when removed from map.
   */
  onRemove: function() {
    remove(this._image);
    if (this.options.interactive) {
      this.removeInteractiveTarget(this._image);
    }
  },

  /**
   * Sets image opacity.
   * @param {number} opacity Opacity value (0–1).
   * @return {!ImageOverlay} This overlay.
   */
  setOpacity: function(opacity) {
    this.options.opacity = opacity;
    if (this._image) {
      this._updateOpacity();
    }
    return this;
  },

  /**
   * Sets style options.
   * @param {!Object} styleOpts Style options.
   * @return {!ImageOverlay} This overlay.
   */
  setStyle: function(styleOpts) {
    if (styleOpts.opacity) {
      this.setOpacity(styleOpts.opacity);
    }
    return this;
  },

  /**
   * Brings overlay to front.
   * @return {!ImageOverlay} This overlay.
   */
  bringToFront: function() {
    if (this._map) {
      toFront(this._image);
    }
    return this;
  },

  /**
   * Brings overlay to back.
   * @return {!ImageOverlay} This overlay.
   */
  bringToBack: function() {
    if (this._map) {
      toBack(this._image);
    }
    return this;
  },

  /**
   * Sets image URL.
   * @param {string} url New URL.
   * @return {!ImageOverlay} This overlay.
   */
  setUrl: function(url) {
    this._url = url;
    if (this._image) {
      this._image.src = url;
    }
    return this;
  },

  /**
   * Sets image bounds.
   * @param {!LatLngBounds|LatLng[]} bounds New bounds.
   * @return {!ImageOverlay} This overlay.
   */
  setBounds: function(bounds) {
    this._bounds = toLatLngBounds(bounds);
    if (this._map) {
      this._reset();
    }
    return this;
  },

  /**
   * Gets events handled by overlay.
   * @return {!Object} Events map.
   */
  getEvents: function() {
    const events = {
      zoom: this._reset,
      viewreset: this._reset,
    };
    if (this._zoomAnimated) {
      events.zoomanim = this._animateZoom;
    }
    return events;
  },

  /**
   * Sets z-index.
   * @param {number} value Z-index value.
   * @return {!ImageOverlay} This overlay.
   */
  setZIndex: function(value) {
    this.options.zIndex = value;
    this._updateZIndex();
    return this;
  },

  /**
   * Gets image bounds.
   * @return {!LatLngBounds} Bounds.
   */
  getBounds: function() {
    return this._bounds;
  },

  /**
   * Gets image element.
   * @return {Element} Image element.
   */
  getElement: function() {
    return this._image;
  },

  /**
   * Initializes image element.
   * @private
   */
  _initImage: function() {
    const wasElementSupplied = this._url.tagName === 'IMG';
    const img = this._image = wasElementSupplied ? this._url : create$1('img');
    addClass(img, 'atlas-image-layer');
    if (this._zoomAnimated) {
      addClass(img, 'atlas-zoom-animated');
    }
    if (this.options.className) {
      addClass(img, this.options.className);
    }
    img.onselectstart = falseFn;
    img.onmousemove = falseFn;
    img.onload = bind(this.fire, this, 'load');
    img.onerror = bind(this._overlayOnError, this, 'error');
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    if (this.options.zIndex) {
      this._updateZIndex();
    }
    if (wasElementSupplied) {
      this._url = img.src;
      return;
    }
    img.src = this._url;
    img.alt = this.options.alt;
  },

  /**
   * Animates zoom.
   * @param {!Object} e Zoom event.
   * @private
   */
  _animateZoom: function(e) {
    const scale = this._map.getZoomScale(e.zoom);
    const offset = this._map._latLngBoundsToNewLayerBounds(
        this._bounds, e.zoom, e.center).min;
    setTransform(this._image, offset, scale);
  },

  /**
   * Resets image position and size.
   * @private
   */
  _reset: function() {
    const image = this._image;
    const bounds = new Bounds(
        this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
        this._map.latLngToLayerPoint(this._bounds.getSouthEast()));
    const size = bounds.getSize();
    setPosition(image, bounds.min);
    image.style.width = size.x + 'px';
    image.style.height = size.y + 'px';
  },

  /**
   * Updates image opacity.
   * @private
   */
  _updateOpacity: function() {
    setOpacity(this._image, this.options.opacity);
  },

  /**
   * Updates z-index.
   * @private
   */
  _updateZIndex: function() {
    if (this._image && this.options.zIndex !== undefined &&
        this.options.zIndex !== null) {
      this._image.style.zIndex = this.options.zIndex;
    }
  },

  /**
   * Handles image load error.
   * @private
   */
  _overlayOnError: function() {
    this.fire('error');
    const errorUrl = this.options.errorOverlayUrl;
    if (errorUrl && this._url !== errorUrl) {
      this._url = errorUrl;
      this._image.src = errorUrl;
    }
  },

  /**
   * Gets center of bounds.
   * @return {!LatLng} Center.
   */
  getCenter: function() {
    return this._bounds.getCenter();
  },
});

/**
 * Creates an image overlay.
 * @param {string|Element} url Image URL or element.
 * @param {!LatLngBounds|LatLng[]} bounds Image bounds.
 * @param {Object=} options Options.
 * @return {!ImageOverlay} New image overlay.
 */
function imageOverlay(url, bounds, options) {
  return new ImageOverlay(url, bounds, options);
}

/**
 * Overlays a video on the map.
 * @extends {ImageOverlay}
 */
const VideoOverlay = ImageOverlay.extend(/** @lends VideoOverlay.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    autoplay: true,
    loop: true,
    keepAspectRatio: true,
    muted: false,
    playsInline: true,
  },

  /**
   * Initializes video element.
   * @private
   */
  _initImage: function() {
    const wasElementSupplied = this._url.tagName === 'VIDEO';
    const vid = this._image = wasElementSupplied ? this._url : create$1('video');
    addClass(vid, 'atlas-image-layer');
    if (this._zoomAnimated) {
      addClass(vid, 'atlas-zoom-animated');
    }
    if (this.options.className) {
      addClass(vid, this.options.className);
    }
    vid.onselectstart = falseFn;
    vid.onmousemove = falseFn;
    vid.onloadeddata = bind(this.fire, this, 'load');
    if (wasElementSupplied) {
      const sourceElements = vid.getElementsByTagName('source');
      const sources = [];
      for (let j = 0; j < sourceElements.length; j++) {
        sources.push(sourceElements[j].src);
      }
      this._url = (sourceElements.length > 0) ? sources : [vid.src];
      return;
    }
    if (!isArray(this._url)) {
      this._url = [this._url];
    }
    if (!this.options.keepAspectRatio &&
        Object.prototype.hasOwnProperty.call(vid.style, 'objectFit')) {
      vid.style['objectFit'] = 'fill';
    }
    vid.autoplay = !!this.options.autoplay;
    vid.loop = !!this.options.loop;
    vid.muted = !!this.options.muted;
    vid.playsInline = !!this.options.playsInline;
    for (let i = 0; i < this._url.length; i++) {
      const source = create$1('source');
      source.src = this._url[i];
      vid.appendChild(source);
    }
  },
});

/**
 * Creates a video overlay.
 * @param {string|Array<string>|Element} video Video URL(s) or element.
 * @param {!LatLngBounds|LatLng[]} bounds Video bounds.
 * @param {Object=} options Options.
 * @return {!VideoOverlay} New video overlay.
 */
function videoOverlay(video, bounds, options) {
  return new VideoOverlay(video, bounds, options);
}

/**
 * Overlays an SVG element on the map.
 * @extends {ImageOverlay}
 */
const SVGOverlay = ImageOverlay.extend(/** @lends SVGOverlay.prototype */ {
  /**
   * Initializes SVG element.
   * @private
   */
  _initImage: function() {
    const el = this._image = this._url;
    addClass(el, 'atlas-image-layer');
    if (this._zoomAnimated) {
      addClass(el, 'atlas-zoom-animated');
    }
    if (this.options.className) {
      addClass(el, this.options.className);
    }
    el.onselectstart = falseFn;
    el.onmousemove = falseFn;
  },
});

/**
 * Creates an SVG overlay.
 * @param {!Element} el SVG element.
 * @param {!LatLngBounds|LatLng[]} bounds SVG bounds.
 * @param {Object=} options Options.
 * @return {!SVGOverlay} New SVG overlay.
 */
function svgOverlay(el, bounds, options) {
  return new SVGOverlay(el, bounds, options);
}

/**
 * Icon implementation using a DIV element.
 * @extends {Icon}
 */
class DivIcon extends Icon {
  /**
   * Creates icon element.
   * @param {Element=} oldIcon Existing icon element.
   * @return {!Element} Created icon element.
   */
  createIcon(oldIcon) {
    const div = (oldIcon && oldIcon.tagName === 'DIV') ?
        oldIcon : document.createElement('div');
    const options = this.options;
    if (options.html instanceof Element) {
      empty(div);
      div.appendChild(options.html);
    } else {
      div.innerHTML = options.html !== false ? options.html : '';
    }
    if (options.bgPos) {
      const bgPos = toPoint(options.bgPos);
      div.style.backgroundPosition = `${-bgPos.x}px ${-bgPos.y}px`;
    }
    this._setIconStyles(div, 'icon');
    return div;
  }

  /**
   * Creates shadow element (always null for DivIcon).
   * @return {null} Always null.
   */
  createShadow() {
    return null;
  }
}

DivIcon.prototype.options = Object.create(Icon.prototype.options);
Object.assign(DivIcon.prototype.options, {
  iconSize: [12, 12],
  html: false,
  bgPos: null,
  className: 'atlas-div-icon',
});

/**
 * Creates a div icon.
 * @param {Object=} options Icon options.
 * @return {!DivIcon} New div icon.
 */
function divIcon(options) {
  return new DivIcon(options);
}
