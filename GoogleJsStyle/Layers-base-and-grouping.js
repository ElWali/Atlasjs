/**
 * Abstract base class for map layers.
 * @extends {Evented}
 */
const Layer = Evented.extend(/** @lends Layer.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    pane: 'overlayPane',
    attribution: null,
    bubblingMouseEvents: true,
  },

  /**
   * Adds layer to map.
   * @param {!Map} map Map instance.
   * @return {!Layer} This layer.
   */
  addTo: function(map) {
    map.addLayer(this);
    return this;
  },

  /**
   * Removes layer from map.
   * @return {!Layer} This layer.
   */
  remove: function() {
    return this.removeFrom(this._map || this._mapToAdd);
  },

  /**
   * Removes layer from object.
   * @param {Map|LayerGroup} obj Map or layer group.
   * @return {!Layer} This layer.
   */
  removeFrom: function(obj) {
    if (obj) {
      obj.removeLayer(this);
    }
    return this;
  },

  /**
   * Gets pane by name.
   * @param {string=} name Pane name.
   * @return {Element} Pane element.
   */
  getPane: function(name) {
    return this._map.getPane(name ? (this.options[name] || name) : this.options.pane);
  },

  /**
   * Adds interactive target.
   * @param {!Element} targetEl Target element.
   * @return {!Layer} This layer.
   */
  addInteractiveTarget: function(targetEl) {
    this._map._targets[stamp(targetEl)] = this;
    return this;
  },

  /**
   * Removes interactive target.
   * @param {!Element} targetEl Target element.
   * @return {!Layer} This layer.
   */
  removeInteractiveTarget: function(targetEl) {
    delete this._map._targets[stamp(targetEl)];
    return this;
  },

  /**
   * Gets attribution string.
   * @return {?string} Attribution.
   */
  getAttribution: function() {
    return this.options.attribution;
  },

  /**
   * Internal method called when layer is added to map.
   * @param {!Object} e Event object.
   * @private
   */
  _layerAdd: function(e) {
    const map = e.target;
    if (!map.hasLayer(this)) {
      return;
    }
    this._map = map;
    this._zoomAnimated = map._zoomAnimated;
    if (this.getEvents) {
      const events = this.getEvents();
      map.on(events, this);
      this.once('remove', function() {
        map.off(events, this);
      }, this);
    }
    this.onAdd(map);
    this.fire('add');
    map.fire('layeradd', {layer: this});
  },
});

/**
 * Adds layer to map.
 * @param {!Layer} layer Layer to add.
 * @return {!Map} This map.
 */
Map.include({
  addLayer: function(layer) {
    if (!layer._layerAdd) {
      throw new Error('The provided object is not a Layer.');
    }
    const id = stamp(layer);
    if (this._layers[id]) {
      return this;
    }
    this._layers[id] = layer;
    layer._mapToAdd = this;
    if (layer.beforeAdd) {
      layer.beforeAdd(this);
    }
    this.whenReady(layer._layerAdd, layer);
    return this;
  },

  /**
   * Removes layer from map.
   * @param {!Layer} layer Layer to remove.
   * @return {!Map} This map.
   */
  removeLayer: function(layer) {
    const id = stamp(layer);
    if (!this._layers[id]) {
      return this;
    }
    if (this._loaded) {
      layer.onRemove(this);
    }
    delete this._layers[id];
    if (this._loaded) {
      this.fire('layerremove', {layer: layer});
      layer.fire('remove');
    }
    layer._map = layer._mapToAdd = null;
    return this;
  },

  /**
   * Checks if map has layer.
   * @param {!Layer} layer Layer to check.
   * @return {boolean} Whether has layer.
   */
  hasLayer: function(layer) {
    return stamp(layer) in this._layers;
  },

  /**
   * Iterates over layers.
   * @param {Function} method Callback function.
   * @param {Object=} context Execution context.
   * @return {!Map} This map.
   */
  eachLayer: function(method, context) {
    for (const i in this._layers) {
      method.call(context, this._layers[i]);
    }
    return this;
  },

  /**
   * Adds multiple layers.
   * @param {Array<!Layer>} layers Layers to add.
   * @private
   */
  _addLayers: function(layers) {
    layers = layers ? (isArray(layers) ? layers : [layers]) : [];
    for (let i = 0, len = layers.length; i < len; i++) {
      this.addLayer(layers[i]);
    }
  },

  /**
   * Adds zoom limit for layer.
   * @param {!Layer} layer Layer with zoom limits.
   * @private
   */
  _addZoomLimit: function(layer) {
    if (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom)) {
      this._zoomBoundLayers[stamp(layer)] = layer;
      this._updateZoomLevels();
    }
  },

  /**
   * Removes zoom limit for layer.
   * @param {!Layer} layer Layer to remove limit from.
   * @private
   */
  _removeZoomLimit: function(layer) {
    const id = stamp(layer);
    if (this._zoomBoundLayers[id]) {
      delete this._zoomBoundLayers[id];
      this._updateZoomLevels();
    }
  },

  /**
   * Updates zoom levels based on layer bounds.
   * @private
   */
  _updateZoomLevels: function() {
    let minZoom = Infinity;
    let maxZoom = -Infinity;
    const oldZoomSpan = this._getZoomSpan();
    for (const i in this._zoomBoundLayers) {
      const options = this._zoomBoundLayers[i].options;
      minZoom = options.minZoom === undefined ? minZoom : Math.min(minZoom, options.minZoom);
      maxZoom = options.maxZoom === undefined ? maxZoom : Math.max(maxZoom, options.maxZoom);
    }
    this._layersMaxZoom = maxZoom === -Infinity ? undefined : maxZoom;
    this._layersMinZoom = minZoom === Infinity ? undefined : minZoom;
    if (oldZoomSpan !== this._getZoomSpan()) {
      this.fire('zoomlevelschange');
    }
    if (this.options.maxZoom === undefined && this._layersMaxZoom &&
        this.getZoom() > this._layersMaxZoom) {
      this.setZoom(this._layersMaxZoom);
    }
    if (this.options.minZoom === undefined && this._layersMinZoom &&
        this.getZoom() < this._layersMinZoom) {
      this.setZoom(this._layersMinZoom);
    }
  },
});

/**
 * Group of layers.
 * @extends {Layer}
 */
const LayerGroup = Layer.extend(/** @lends LayerGroup.prototype */ {
  /**
   * @param {Array<!Layer>=} layers Initial layers.
   * @param {Object=} options Options.
   */
  initialize: function(layers, options) {
    setOptions(this, options);
    this._layers = {};
    if (layers) {
      for (let i = 0, len = layers.length; i < len; i++) {
        this.addLayer(layers[i]);
      }
    }
  },

  /**
   * Adds layer to group.
   * @param {!Layer} layer Layer to add.
   * @return {!LayerGroup} This group.
   */
  addLayer: function(layer) {
    const id = this.getLayerId(layer);
    this._layers[id] = layer;
    if (this._map) {
      this._map.addLayer(layer);
    }
    return this;
  },

  /**
   * Removes layer from group.
   * @param {!Layer|number} layer Layer or ID to remove.
   * @return {!LayerGroup} This group.
   */
  removeLayer: function(layer) {
    const id = layer in this._layers ? layer : this.getLayerId(layer);
    if (this._map && this._layers[id]) {
      this._map.removeLayer(this._layers[id]);
    }
    delete this._layers[id];
    return this;
  },

  /**
   * Checks if group has layer.
   * @param {!Layer|number} layer Layer or ID to check.
   * @return {boolean} Whether has layer.
   */
  hasLayer: function(layer) {
    const layerId = typeof layer === 'number' ? layer : this.getLayerId(layer);
    return layerId in this._layers;
  },

  /**
   * Removes all layers.
   * @return {!LayerGroup} This group.
   */
  clearLayers: function() {
    return this.eachLayer(this.removeLayer, this);
  },

  /**
   * Invokes method on all layers.
   * @param {string} methodName Method name.
   * @param {...*} args Method arguments.
   * @return {!LayerGroup} This group.
   */
  invoke: function(methodName) {
    const args = Array.prototype.slice.call(arguments, 1);
    for (const i in this._layers) {
      const layer = this._layers[i];
      if (layer[methodName]) {
        layer[methodName].apply(layer, args);
      }
    }
    return this;
  },

  /**
   * Called when added to map.
   * @param {!Map} map Map instance.
   */
  onAdd: function(map) {
    this.eachLayer(map.addLayer, map);
  },

  /**
   * Called when removed from map.
   * @param {!Map} map Map instance.
   */
  onRemove: function(map) {
    this.eachLayer(map.removeLayer, map);
  },

  /**
   * Iterates over layers.
   * @param {Function} method Callback function.
   * @param {Object=} context Execution context.
   * @return {!LayerGroup} This group.
   */
  eachLayer: function(method, context) {
    for (const i in this._layers) {
      method.call(context, this._layers[i]);
    }
    return this;
  },

  /**
   * Gets layer by ID.
   * @param {number} id Layer ID.
   * @return {!Layer} Layer.
   */
  getLayer: function(id) {
    return this._layers[id];
  },

  /**
   * Gets all layers.
   * @return {Array<!Layer>} Layers array.
   */
  getLayers: function() {
    const layers = [];
    this.eachLayer(layers.push, layers);
    return layers;
  },

  /**
   * Sets Z-index for all layers.
   * @param {number} zIndex Z-index value.
   * @return {!LayerGroup} This group.
   */
  setZIndex: function(zIndex) {
    return this.invoke('setZIndex', zIndex);
  },

  /**
   * Gets layer ID.
   * @param {!Layer} layer Layer.
   * @return {number} Layer ID.
   */
  getLayerId: function(layer) {
    return stamp(layer);
  },
});

/**
 * Creates a layer group.
 * @param {Array<!Layer>=} layers Initial layers.
 * @param {Object=} options Options.
 * @return {!LayerGroup} New layer group.
 */
function layerGroup(layers, options) {
  return new LayerGroup(layers, options);
}

/**
 * Feature group with additional events.
 * @extends {LayerGroup}
 */
const FeatureGroup = LayerGroup.extend(/** @lends FeatureGroup.prototype */ {
  /**
   * Adds layer to group.
   * @param {!Layer} layer Layer to add.
   * @return {!FeatureGroup} This group.
   */
  addLayer: function(layer) {
    if (this.hasLayer(layer)) {
      return this;
    }
    layer.addEventParent(this);
    LayerGroup.prototype.addLayer.call(this, layer);
    return this.fire('layeradd', {layer: layer});
  },

  /**
   * Removes layer from group.
   * @param {!Layer} layer Layer to remove.
   * @return {!FeatureGroup} This group.
   */
  removeLayer: function(layer) {
    if (!this.hasLayer(layer)) {
      return this;
    }
    if (layer in this._layers) {
      layer = this._layers[layer];
    }
    layer.removeEventParent(this);
    LayerGroup.prototype.removeLayer.call(this, layer);
    return this.fire('layerremove', {layer: layer});
  },

  /**
   * Sets style for all layers.
   * @param {!Object} style Style options.
   * @return {!FeatureGroup} This group.
   */
  setStyle: function(style) {
    return this.invoke('setStyle', style);
  },

  /**
   * Brings all layers to front.
   * @return {!FeatureGroup} This group.
   */
  bringToFront: function() {
    return this.invoke('bringToFront');
  },

  /**
   * Brings all layers to back.
   * @return {!FeatureGroup} This group.
   */
  bringToBack: function() {
    return this.invoke('bringToBack');
  },

  /**
   * Gets bounds of all layers.
   * @return {!LatLngBounds} Bounds.
   */
  getBounds: function() {
    const bounds = new LatLngBounds();
    for (const id in this._layers) {
      const layer = this._layers[id];
      bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
    }
    return bounds;
  },
});

/**
 * Creates a feature group.
 * @param {Array<!Layer>=} layers Initial layers.
 * @param {Object=} options Options.
 * @return {!FeatureGroup} New feature group.
 */
function featureGroup(layers, options) {
  return new FeatureGroup(layers, options);
}
