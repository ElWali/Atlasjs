/**
 * Base control class.
 * @extends {Class}
 */
const Control = Class.extend(/** @lends Control.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    position: 'topright',
  },

  /**
   * @param {Object=} options Control options.
   */
  initialize: function(options) {
    setOptions(this, options);
  },

  /**
   * Gets control position.
   * @return {string} Position.
   */
  getPosition: function() {
    return this.options.position;
  },

  /**
   * Sets control position.
   * @param {string} position New position.
   * @return {!Control} This control.
   */
  setPosition: function(position) {
    const map = this._map;
    if (map) {
      map.removeControl(this);
    }
    this.options.position = position;
    if (map) {
      map.addControl(this);
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
   * Adds control to map.
   * @param {!Map} map Map instance.
   * @return {!Control} This control.
   */
  addTo: function(map) {
    this.remove();
    this._map = map;
    const container = this._container = this.onAdd(map);
    const pos = this.getPosition();
    const corner = map._controlCorners[pos];
    addClass(container, 'atlas-control');
    if (pos.indexOf('bottom') !== -1) {
      corner.insertBefore(container, corner.firstChild);
    } else {
      corner.appendChild(container);
    }
    this._map.on('unload', this.remove, this);
    return this;
  },

  /**
   * Removes control from map.
   * @return {!Control} This control.
   */
  remove: function() {
    if (!this._map) {
      return this;
    }
    remove(this._container);
    if (this.onRemove) {
      this.onRemove(this._map);
    }
    this._map.off('unload', this.remove, this);
    this._map = null;
    return this;
  },

  /**
   * Refocuses on map.
   * @param {Event=} e Event.
   * @private
   */
  _refocusOnMap: function(e) {
    if (this._map && e && e.screenX > 0 && e.screenY > 0) {
      this._map.getContainer().focus();
    }
  },
});

/**
 * Creates a control.
 * @param {Object=} options Control options.
 * @return {!Control} New control.
 */
function control(options) {
  return new Control(options);
}

// Add control methods to Map
Map.include({
  /**
   * Adds control to map.
   * @param {!Control} control Control instance.
   * @return {!Map} This map.
   */
  addControl: function(control) {
    control.addTo(this);
    return this;
  },

  /**
   * Removes control from map.
   * @param {!Control} control Control instance.
   * @return {!Map} This map.
   */
  removeControl: function(control) {
    control.remove();
    return this;
  },

  /**
   * Initializes control positions.
   * @private
   */
  _initControlPos: function() {
    const corners = this._controlCorners = {};
    const l = 'atlas-';
    const container = this._controlContainer =
        create$1('div', l + 'control-container', this._container);
    /**
     * Creates a control corner.
     * @param {string} vSide Vertical side.
     * @param {string} hSide Horizontal side.
     * @private
     */
    function createCorner(vSide, hSide) {
      const className = l + vSide + ' ' + l + hSide;
      corners[vSide + hSide] = create$1('div', className, container);
    }
    createCorner('top', 'left');
    createCorner('top', 'right');
    createCorner('bottom', 'left');
    createCorner('bottom', 'right');
  },

  /**
   * Clears control positions.
   * @private
   */
  _clearControlPos: function() {
    for (const i in this._controlCorners) {
      remove(this._controlCorners[i]);
    }
    remove(this._controlContainer);
    delete this._controlCorners;
    delete this._controlContainer;
  },
});

/**
 * Layers control for switching base layers and overlays.
 * @extends {Control}
 */
const Layers = Control.extend(/** @lends Layers.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    collapsed: true,
    position: 'topright',
    autoZIndex: true,
    hideSingleBase: false,
    sortLayers: false,
    sortFunction: function(layerA, layerB, nameA, nameB) {
      return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
    },
  },

  /**
   * @param {!Object} baseLayers Base layers mapping.
   * @param {!Object} overlays Overlays mapping.
   * @param {Object=} options Control options.
   */
  initialize: function(baseLayers, overlays, options) {
    setOptions(this, options);
    this._layerControlInputs = [];
    this._layers = [];
    this._lastZIndex = 0;
    this._handlingClick = false;
    this._preventClick = false;
    for (const i in baseLayers) {
      this._addLayer(baseLayers[i], i);
    }
    for (const i in overlays) {
      this._addLayer(overlays[i], i, true);
    }
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   * @return {!Element} Container element.
   */
  onAdd: function(map) {
    this._initLayout();
    this._update();
    this._map = map;
    map.on('zoomend', this._checkDisabledLayers, this);
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].layer.on('add remove', this._onLayerChange, this);
    }
    return this._container;
  },

  /**
   * Adds control to map.
   * @param {!Map} map Map instance.
   * @return {!Layers} This control.
   */
  addTo: function(map) {
    Control.prototype.addTo.call(this, map);
    return this._expandIfNotCollapsed();
  },

  /**
   * Called when removed from map.
   */
  onRemove: function() {
    this._map.off('zoomend', this._checkDisabledLayers, this);
    for (let i = 0; i < this._layers.length; i++) {
      this._layers[i].layer.off('add remove', this._onLayerChange, this);
    }
  },

  /**
   * Adds base layer.
   * @param {!Layer} layer Layer instance.
   * @param {string} name Layer name.
   * @return {!Layers} This control.
   */
  addBaseLayer: function(layer, name) {
    this._addLayer(layer, name);
    return (this._map) ? this._update() : this;
  },

  /**
   * Adds overlay.
   * @param {!Layer} layer Layer instance.
   * @param {string} name Layer name.
   * @return {!Layers} This control.
   */
  addOverlay: function(layer, name) {
    this._addLayer(layer, name, true);
    return (this._map) ? this._update() : this;
  },

  /**
   * Removes layer.
   * @param {!Layer} layer Layer instance.
   * @return {!Layers} This control.
   */
  removeLayer: function(layer) {
    layer.off('add remove', this._onLayerChange, this);
    const obj = this._getLayer(stamp(layer));
    if (obj) {
      this._layers.splice(this._layers.indexOf(obj), 1);
    }
    return (this._map) ? this._update() : this;
  },

  /**
   * Expands control.
   * @return {!Layers} This control.
   */
  expand: function() {
    addClass(this._container, 'atlas-control-layers-expanded');
    this._section.style.height = null;
    const acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
    if (acceptableHeight < this._section.clientHeight) {
      addClass(this._section, 'atlas-control-layers-scrollbar');
      this._section.style.height = acceptableHeight + 'px';
    } else {
      removeClass(this._section, 'atlas-control-layers-scrollbar');
    }
    this._checkDisabledLayers();
    return this;
  },

  /**
   * Collapses control.
   * @return {!Layers} This control.
   */
  collapse: function() {
    removeClass(this._container, 'atlas-control-layers-expanded');
    return this;
  },

  /**
   * Initializes layout.
   * @private
   */
  _initLayout: function() {
    const className = 'atlas-control-layers';
    const container = this._container = create$1('div', className);
    const collapsed = this.options.collapsed;
    container.setAttribute('aria-haspopup', true);
    disableClickPropagation(container);
    disableScrollPropagation(container);
    const section = this._section = create$1('section', className + '-list');
    if (collapsed) {
      this._map.on('click', this.collapse, this);
      on(container, {
        mouseenter: this._expandSafely,
        mouseleave: this.collapse,
      }, this);
    }
    const link = this._layersLink = create$1('a', className + '-toggle', container);
    link.href = '#';
    link.title = 'Layers';
    link.setAttribute('role', 'button');
    on(link, {
      keydown: function(e) {
        if (e.keyCode === 13) {
          this._expandSafely();
        }
      },
      click: function(e) {
        preventDefault(e);
        this._expandSafely();
      },
    }, this);
    if (!collapsed) {
      this.expand();
    }
    this._baseLayersList = create$1('div', className + '-base', section);
    this._separator = create$1('div', className + '-separator', section);
    this._overlaysList = create$1('div', className + '-overlays', section);
    container.appendChild(section);
  },

  /**
   * Gets layer by ID.
   * @param {number} id Layer ID.
   * @return {Object|undefined} Layer object.
   * @private
   */
  _getLayer: function(id) {
    for (let i = 0; i < this._layers.length; i++) {
      if (this._layers[i] && stamp(this._layers[i].layer) === id) {
        return this._layers[i];
      }
    }
  },

  /**
   * Adds layer internally.
   * @param {!Layer} layer Layer instance.
   * @param {string} name Layer name.
   * @param {boolean=} overlay Whether overlay.
   * @private
   */
  _addLayer: function(layer, name, overlay) {
    if (this._map) {
      layer.on('add remove', this._onLayerChange, this);
    }
    this._layers.push({
      layer: layer,
      name: name,
      overlay: overlay,
    });
    if (this.options.sortLayers) {
      this._layers.sort(bind(function(a, b) {
        return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
      }, this));
    }
    if (this.options.autoZIndex && layer.setZIndex) {
      this._lastZIndex++;
      layer.setZIndex(this._lastZIndex);
    }
    this._expandIfNotCollapsed();
  },

  /**
   * Updates control layout.
   * @private
   */
  _update: function() {
    if (!this._container) {
      return this;
    }
    empty(this._baseLayersList);
    empty(this._overlaysList);
    this._layerControlInputs = [];
    let baseLayersPresent = false;
    let overlaysPresent = false;
    let baseLayersCount = 0;
    for (let i = 0; i < this._layers.length; i++) {
      const obj = this._layers[i];
      this._addItem(obj);
      overlaysPresent = overlaysPresent || obj.overlay;
      baseLayersPresent = baseLayersPresent || !obj.overlay;
      baseLayersCount += !obj.overlay ? 1 : 0;
    }
    if (this.options.hideSingleBase) {
      baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
      this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
    }
    this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
    return this;
  },

  /**
   * Handles layer change events.
   * @param {!Object} e Event.
   * @private
   */
  _onLayerChange: function(e) {
    if (!this._handlingClick) {
      this._update();
    }
    const obj = this._getLayer(stamp(e.target));
    const type = obj.overlay ?
        (e.type === 'add' ? 'overlayadd' : 'overlayremove') :
        (e.type === 'add' ? 'baselayerchange' : null);
    if (type) {
      this._map.fire(type, obj);
    }
  },

  /**
   * Creates radio element.
   * @param {string} name Name attribute.
   * @param {boolean} checked Whether checked.
   * @return {!Element} Radio input.
   * @private
   */
  _createRadioElement: function(name, checked) {
    const radioHtml = '<input type="radio" class="atlas-control-layers-selector" name="' +
        name + '"' + (checked ? ' checked="checked"' : '') + '/>';
    const radioFragment = document.createElement('div');
    radioFragment.innerHTML = radioHtml;
    return radioFragment.firstChild;
  },

  /**
   * Adds item to control.
   * @param {!Object} obj Layer object.
   * @return {!Element} Label element.
   * @private
   */
  _addItem: function(obj) {
    const label = document.createElement('label');
    const checked = this._map.hasLayer(obj.layer);
    let input;
    if (obj.overlay) {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'atlas-control-layers-selector';
      input.defaultChecked = checked;
    } else {
      input = this._createRadioElement('atlas-base-layers_' + stamp(this), checked);
    }
    this._layerControlInputs.push(input);
    input.layerId = stamp(obj.layer);
    on(input, 'click', this._onInputClick, this);
    const name = document.createElement('span');
    name.innerHTML = ' ' + obj.name;
    const holder = document.createElement('span');
    label.appendChild(holder);
    holder.appendChild(input);
    holder.appendChild(name);
    const container = obj.overlay ? this._overlaysList : this._baseLayersList;
    container.appendChild(label);
    this._checkDisabledLayers();
    return label;
  },

  /**
   * Handles input click.
   * @private
   */
  _onInputClick: function() {
    if (this._preventClick) {
      return;
    }
    const inputs = this._layerControlInputs;
    const addedLayers = [];
    const removedLayers = [];
    this._handlingClick = true;
    for (let i = inputs.length - 1; i >= 0; i--) {
      const input = inputs[i];
      const layer = this._getLayer(input.layerId).layer;
      if (input.checked) {
        addedLayers.push(layer);
      } else if (!input.checked) {
        removedLayers.push(layer);
      }
    }
    for (let i = 0; i < removedLayers.length; i++) {
      if (this._map.hasLayer(removedLayers[i])) {
        this._map.removeLayer(removedLayers[i]);
      }
    }
    for (let i = 0; i < addedLayers.length; i++) {
      if (!this._map.hasLayer(addedLayers[i])) {
        this._map.addLayer(addedLayers[i]);
      }
    }
    this._handlingClick = false;
    this._refocusOnMap();
  },

  /**
   * Checks disabled layers based on zoom.
   * @private
   */
  _checkDisabledLayers: function() {
    const inputs = this._layerControlInputs;
    const zoom = this._map.getZoom();
    for (let i = inputs.length - 1; i >= 0; i--) {
      const input = inputs[i];
      const layer = this._getLayer(input.layerId).layer;
      input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
          (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);
    }
  },

  /**
   * Expands if not collapsed.
   * @return {!Layers} This control.
   * @private
   */
  _expandIfNotCollapsed: function() {
    if (this._map && !this.options.collapsed) {
      this.expand();
    }
    return this;
  },

  /**
   * Safely expands control.
   * @private
   */
  _expandSafely: function() {
    const section = this._section;
    this._preventClick = true;
    on(section, 'click', preventDefault);
    this.expand();
    const that = this;
    setTimeout(function() {
      off(section, 'click', preventDefault);
      that._preventClick = false;
    });
  },
});

/**
 * Creates a layers control.
 * @param {!Object} baseLayers Base layers mapping.
 * @param {!Object} overlays Overlays mapping.
 * @param {Object=} options Control options.
 * @return {!Layers} New layers control.
 */
function layers(baseLayers, overlays, options) {
  return new Layers(baseLayers, overlays, options);
}

/**
 * Zoom control with +/- buttons.
 * @extends {Control}
 */
const Zoom = Control.extend(/** @lends Zoom.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    position: 'topleft',
    zoomInText: '<span aria-hidden="true">+</span>',
    zoomInTitle: 'Zoom in',
    zoomOutText: '<span aria-hidden="true">&#x2212;</span>',
    zoomOutTitle: 'Zoom out',
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   * @return {!Element} Container element.
   */
  onAdd: function(map) {
    const zoomName = 'atlas-control-zoom';
    const container = create$1('div', zoomName + ' atlas-bar');
    const options = this.options;
    this._zoomInButton = this._createButton(
        options.zoomInText, options.zoomInTitle,
        zoomName + '-in', container, this._zoomIn);
    this._zoomOutButton = this._createButton(
        options.zoomOutText, options.zoomOutTitle,
        zoomName + '-out', container, this._zoomOut);
    this._updateDisabled();
    map.on('zoomend zoomlevelschange', this._updateDisabled, this);
    return container;
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    map.off('zoomend zoomlevelschange', this._updateDisabled, this);
  },

  /**
   * Disables control.
   * @return {!Zoom} This control.
   */
  disable: function() {
    this._disabled = true;
    this._updateDisabled();
    return this;
  },

  /**
   * Enables control.
   * @return {!Zoom} This control.
   */
  enable: function() {
    this._disabled = false;
    this._updateDisabled();
    return this;
  },

  /**
   * Handles zoom in.
   * @param {Event} e Event.
   * @private
   */
  _zoomIn: function(e) {
    if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
      this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
    }
  },

  /**
   * Handles zoom out.
   * @param {Event} e Event.
   * @private
   */
  _zoomOut: function(e) {
    if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
      this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
    }
  },

  /**
   * Creates button element.
   * @param {string} html Button HTML.
   * @param {string} title Button title.
   * @param {string} className CSS class.
   * @param {Element} container Parent container.
   * @param {Function} fn Click handler.
   * @return {!Element} Button element.
   * @private
   */
  _createButton: function(html, title, className, container, fn) {
    const link = create$1('a', className, container);
    link.innerHTML = html;
    link.href = '#';
    link.title = title;
    link.setAttribute('role', 'button');
    link.setAttribute('aria-label', title);
    disableClickPropagation(link);
    on(link, 'click', stop);
    on(link, 'click', fn, this);
    on(link, 'click', this._refocusOnMap, this);
    return link;
  },

  /**
   * Updates disabled state.
   * @private
   */
  _updateDisabled: function() {
    const map = this._map;
    const className = 'atlas-disabled';
    removeClass(this._zoomInButton, className);
    removeClass(this._zoomOutButton, className);
    this._zoomInButton.setAttribute('aria-disabled', 'false');
    this._zoomOutButton.setAttribute('aria-disabled', 'false');
    if (this._disabled || map._zoom === map.getMinZoom()) {
      addClass(this._zoomOutButton, className);
      this._zoomOutButton.setAttribute('aria-disabled', 'true');
    }
    if (this._disabled || map._zoom === map.getMaxZoom()) {
      addClass(this._zoomInButton, className);
      this._zoomInButton.setAttribute('aria-disabled', 'true');
    }
  },
});

// Add zoom control to Map by default
Map.mergeOptions({
  zoomControl: true,
});

Map.addInitHook(function() {
  if (this.options.zoomControl) {
    this.zoomControl = new Zoom();
    this.addControl(this.zoomControl);
  }
});

/**
 * Creates a zoom control.
 * @param {Object=} options Control options.
 * @return {!Zoom} New zoom control.
 */
function zoom(options) {
  return new Zoom(options);
}

/**
 * Scale control showing distance scale.
 * @extends {Control}
 */
const Scale = Control.extend(/** @lends Scale.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    position: 'bottomleft',
    maxWidth: 100,
    metric: true,
    imperial: true,
    updateWhenIdle: false,
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   * @return {!Element} Container element.
   */
  onAdd: function(map) {
    const className = 'atlas-control-scale';
    const container = create$1('div', className);
    const options = this.options;
    this._addScales(options, className + '-line', container);
    map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
    map.whenReady(this._update, this);
    return container;
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
  },

  /**
   * Adds scale elements.
   * @param {!Object} options Control options.
   * @param {string} className CSS class.
   * @param {Element} container Parent container.
   * @private
   */
  _addScales: function(options, className, container) {
    if (options.metric) {
      this._mScale = create$1('div', className, container);
    }
    if (options.imperial) {
      this._iScale = create$1('div', className, container);
    }
  },

  /**
   * Updates scale.
   * @private
   */
  _update: function() {
    const map = this._map;
    const y = map.getSize().y / 2;
    const maxMeters = map.distance(
        map.containerPointToLatLng([0, y]),
        map.containerPointToLatLng([this.options.maxWidth, y]));
    this._updateScales(maxMeters);
  },

  /**
   * Updates scales with max distance.
   * @param {number} maxMeters Maximum distance in meters.
   * @private
   */
  _updateScales: function(maxMeters) {
    if (this.options.metric && maxMeters) {
      this._updateMetric(maxMeters);
    }
    if (this.options.imperial && maxMeters) {
      this._updateImperial(maxMeters);
    }
  },

  /**
   * Updates metric scale.
   * @param {number} maxMeters Maximum distance.
   * @private
   */
  _updateMetric: function(maxMeters) {
    const meters = this._getRoundNum(maxMeters);
    const label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';
    this._updateScale(this._mScale, label, meters / maxMeters);
  },

  /**
   * Updates imperial scale.
   * @param {number} maxMeters Maximum distance.
   * @private
   */
  _updateImperial: function(maxMeters) {
    const maxFeet = maxMeters * 3.2808399;
    if (maxFeet > 5280) {
      const maxMiles = maxFeet / 5280;
      const miles = this._getRoundNum(maxMiles);
      this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);
    } else {
      const feet = this._getRoundNum(maxFeet);
      this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
    }
  },

  /**
   * Updates individual scale element.
   * @param {Element} scale Scale element.
   * @param {string} text Scale text.
   * @param {number} ratio Scale ratio.
   * @private
   */
  _updateScale: function(scale, text, ratio) {
    scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
    scale.innerHTML = text;
  },

  /**
   * Gets rounded number for scale.
   * @param {number} num Input number.
   * @return {number} Rounded number.
   * @private
   */
  _getRoundNum: function(num) {
    const pow10 = Math.pow(10, (Math.floor(num) + '').length - 1);
    const d = num / pow10;
    const rounded = d >= 10 ? 10 :
        d >= 5 ? 5 :
        d >= 3 ? 3 :
        d >= 2 ? 2 : 1;
    return pow10 * rounded;
  },
});

/**
 * Creates a scale control.
 * @param {Object=} options Control options.
 * @return {!Scale} New scale control.
 */
function scale(options) {
  return new Scale(options);
}

/**
 * Moroccan flag SVG for attribution.
 * @type {string}
 */
const MoroccanFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" ' +
    'width="12" height="8" viewBox="0 0 12 8" class="atlas-attribution-flag">' +
    '<rect width="12" height="8" fill="#c1272d"/>' +
    '<path d="M6 2l1.176 3.608H3.824L5 3.392 6 2z" fill="#006233"/></svg>';

/**
 * Attribution control showing map credits.
 * @extends {Control}
 */
const Attribution = Control.extend(/** @lends Attribution.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    position: 'bottomright',
    prefix: '<a href="https://atlasjs.com" title="A JavaScript library for interactive maps">' +
        (Browser.inlineSvg ? MoroccanFlag + ' ' : '') + 'Atlas</a>',
  },

  /**
   * @param {Object=} options Control options.
   */
  initialize: function(options) {
    setOptions(this, options);
    this._attributions = {};
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   * @return {!Element} Container element.
   */
  onAdd: function(map) {
    map.attributionControl = this;
    this._container = create$1('div', 'atlas-control-attribution');
    disableClickPropagation(this._container);
    for (const i in map._layers) {
      if (map._layers[i].getAttribution) {
        this.addAttribution(map._layers[i].getAttribution());
      }
    }
    this._update();
    map.on('layeradd', this._addAttribution, this);
    return this._container;
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    map.off('layeradd', this._addAttribution, this);
  },

  /**
   * Handles layer addition for attribution.
   * @param {!Object} ev Event.
   * @private
   */
  _addAttribution: function(ev) {
    if (ev.layer.getAttribution) {
      this.addAttribution(ev.layer.getAttribution());
      ev.layer.once('remove', function() {
        this.removeAttribution(ev.layer.getAttribution());
      }, this);
    }
  },

  /**
   * Sets prefix text.
   * @param {string} prefix New prefix.
   * @return {!Attribution} This control.
   */
  setPrefix: function(prefix) {
    this.options.prefix = prefix;
    this._update();
    return this;
  },

  /**
   * Adds attribution text.
   * @param {string} text Attribution text.
   * @return {!Attribution} This control.
   */
  addAttribution: function(text) {
    if (!text) {
      return this;
    }
    if (!this._attributions[text]) {
      this._attributions[text] = 0;
    }
    this._attributions[text]++;
    this._update();
    return this;
  },

  /**
   * Removes attribution text.
   * @param {string} text Attribution text.
   * @return {!Attribution} This control.
   */
  removeAttribution: function(text) {
    if (!text) {
      return this;
    }
    if (this._attributions[text]) {
      this._attributions[text]--;
      this._update();
    }
    return this;
  },

  /**
   * Updates attribution display.
   * @private
   */
  _update: function() {
    if (!this._map) {
      return;
    }
    const attribs = [];
    for (const i in this._attributions) {
      if (this._attributions[i]) {
        attribs.push(i);
      }
    }
    const prefixAndAttribs = [];
    if (this.options.prefix) {
      prefixAndAttribs.push(this.options.prefix);
    }
    if (attribs.length) {
      prefixAndAttribs.push(attribs.join(', '));
    }
    this._container.innerHTML = prefixAndAttribs.join(' <span aria-hidden="true">|</span> ');
  },
});

// Add attribution control to Map by default
Map.mergeOptions({
  attributionControl: true,
});

Map.addInitHook(function() {
  if (this.options.attributionControl) {
    new Attribution().addTo(this);
  }
});

/**
 * Creates an attribution control.
 * @param {Object=} options Control options.
 * @return {!Attribution} New attribution control.
 */
function attribution(options) {
  return new Attribution(options);
}

// Export control classes and factory functions
Control.Layers = Layers;
Control.Zoom = Zoom;
Control.Scale = Scale;
Control.Attribution = Attribution;

control.layers = layers;
control.zoom = zoom;
control.scale = scale;
control.attribution = attribution;
