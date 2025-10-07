/**
 * GeoJSON layer for displaying GeoJSON data.
 * @extends {FeatureGroup}
 */
const GeoJSON = FeatureGroup.extend(/** @lends GeoJSON.prototype */ {
  /**
   * @param {Object|Array<Object>} geojson GeoJSON data.
   * @param {Object=} options Layer options.
   */
  initialize: function(geojson, options) {
    setOptions(this, options);
    this._layers = {};
    if (geojson) {
      this.addData(geojson);
    }
  },

  /**
   * Adds GeoJSON data to layer.
   * @param {Object|Array<Object>} geojson GeoJSON data.
   * @return {!GeoJSON} This layer.
   */
  addData: function(geojson) {
    const features = isArray(geojson) ? geojson : geojson.features;
    let i;
    let len;
    let feature;
    if (features) {
      for (i = 0, len = features.length; i < len; i++) {
        feature = features[i];
        if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
          this.addData(feature);
        }
      }
      return this;
    }
    const options = this.options;
    if (options.filter && !options.filter(geojson)) {
      return this;
    }
    const layer = geometryToLayer(geojson, options);
    if (!layer) {
      return this;
    }
    layer.feature = asFeature(geojson);
    layer.defaultOptions = layer.options;
    this.resetStyle(layer);
    if (options.onEachFeature) {
      options.onEachFeature(geojson, layer);
    }
    return this.addLayer(layer);
  },

  /**
   * Resets layer style to default.
   * @param {Layer=} layer Layer to reset (or all layers if undefined).
   * @return {!GeoJSON} This layer.
   */
  resetStyle: function(layer) {
    if (layer === undefined) {
      return this.eachLayer(this.resetStyle, this);
    }
    layer.options = extend({}, layer.defaultOptions);
    this._setLayerStyle(layer, this.options.style);
    return this;
  },

  /**
   * Sets style for all layers.
   * @param {Object|Function} style Style options or function.
   * @return {!GeoJSON} This layer.
   */
  setStyle: function(style) {
    return this.eachLayer(function(layer) {
      this._setLayerStyle(layer, style);
    }, this);
  },

  /**
   * Sets style for individual layer.
   * @param {!Layer} layer Layer instance.
   * @param {Object|Function} style Style options or function.
   * @private
   */
  _setLayerStyle: function(layer, style) {
    if (layer.setStyle) {
      if (typeof style === 'function') {
        style = style(layer.feature);
      }
      layer.setStyle(style);
    }
  },
});

/**
 * Converts GeoJSON geometry to layer.
 * @param {Object} geojson GeoJSON object.
 * @param {Object=} options Layer options.
 * @return {Layer|undefined} Created layer.
 * @private
 */
function geometryToLayer(geojson, options) {
  const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
  const coords = geometry ? geometry.coordinates : null;
  const layers = [];
  const pointToLayer = options && options.pointToLayer;
  const _coordsToLatLng = options && options.coordsToLatLng || coordsToLatLng;
  let latlng;
  let latlngs;
  let i;
  let len;
  if (!coords && !geometry) {
    return null;
  }
  switch (geometry.type) {
    case 'Point':
      latlng = _coordsToLatLng(coords);
      return _pointToLayer(pointToLayer, geojson, latlng, options);
    case 'MultiPoint':
      for (i = 0, len = coords.length; i < len; i++) {
        latlng = _coordsToLatLng(coords[i]);
        layers.push(_pointToLayer(pointToLayer, geojson, latlng, options));
      }
      return new FeatureGroup(layers);
    case 'LineString':
    case 'MultiLineString':
      latlngs = coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
      return new Polyline(latlngs, options);
    case 'Polygon':
    case 'MultiPolygon':
      latlngs = coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
      return new Polygon(latlngs, options);
    case 'GeometryCollection':
      for (i = 0, len = geometry.geometries.length; i < len; i++) {
        const geoLayer = geometryToLayer({
          geometry: geometry.geometries[i],
          type: 'Feature',
          properties: geojson.properties,
        }, options);
        if (geoLayer) {
          layers.push(geoLayer);
        }
      }
      return new FeatureGroup(layers);
    default:
      throw new Error('Invalid GeoJSON object.');
  }
}

/**
 * Creates point layer from GeoJSON.
 * @param {Function=} pointToLayerFn Custom point-to-layer function.
 * @param {Object} geojson GeoJSON object.
 * @param {!LatLng} latlng Converted LatLng.
 * @param {Object=} options Layer options.
 * @return {!Layer} Created layer.
 * @private
 */
function _pointToLayer(pointToLayerFn, geojson, latlng, options) {
  return pointToLayerFn ?
      pointToLayerFn(geojson, latlng) :
      new Marker(latlng, options && options.markersInheritOptions && options);
}

/**
 * Converts coordinates array to LatLng.
 * @param {number[]} coords Coordinate array [longitude, latitude, altitude?].
 * @return {!LatLng} LatLng instance.
 */
function coordsToLatLng(coords) {
  return new LatLng(coords[1], coords[0], coords[2]);
}

/**
 * Converts nested coordinates to LatLng arrays.
 * @param {Array} coords Coordinate arrays.
 * @param {number} levelsDeep Nesting level.
 * @param {Function=} _coordsToLatLng Conversion function.
 * @return {LatLng[][]|LatLng[]} Converted coordinates.
 */
function coordsToLatLngs(coords, levelsDeep, _coordsToLatLng) {
  const latlngs = [];
  for (let i = 0, len = coords.length, latlng; i < len; i++) {
    latlng = levelsDeep ?
        coordsToLatLngs(coords[i], levelsDeep - 1, _coordsToLatLng) :
        (_coordsToLatLng || coordsToLatLng)(coords[i]);
    latlngs.push(latlng);
  }
  return latlngs;
}

/**
 * Converts LatLng to coordinate array.
 * @param {!LatLng|number[]} latlng LatLng or array.
 * @param {number=} precision Coordinate precision.
 * @return {number[]} Coordinate array.
 */
function latLngToCoords(latlng, precision) {
  latlng = toLatLng(latlng);
  return latlng.alt !== undefined ?
      [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] :
      [formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
}

/**
 * Converts LatLng arrays to coordinate arrays.
 * @param {LatLng[][]|LatLng[]} latlngs LatLng arrays.
 * @param {number} levelsDeep Nesting level.
 * @param {boolean} closed Whether to close rings.
 * @param {number=} precision Coordinate precision.
 * @return {number[][]|number[]} Coordinate arrays.
 */
function latLngsToCoords(latlngs, levelsDeep, closed, precision) {
  const coords = [];
  for (let i = 0, len = latlngs.length; i < len; i++) {
    coords.push(levelsDeep ?
        latLngsToCoords(latlngs[i], isFlat(latlngs[i]) ? 0 : levelsDeep - 1, closed, precision) :
        latLngToCoords(latlngs[i], precision));
  }
  if (!levelsDeep && closed && coords.length > 0) {
    coords.push(coords[0].slice());
  }
  return coords;
}

/**
 * Creates GeoJSON feature from layer.
 * @param {!Layer} layer Layer instance.
 * @param {Object} newGeometry New geometry.
 * @return {Object} GeoJSON feature.
 * @private
 */
function getFeature(layer, newGeometry) {
  return layer.feature ?
      extend({}, layer.feature, {geometry: newGeometry}) :
      asFeature(newGeometry);
}

/**
 * Normalizes GeoJSON to Feature format.
 * @param {Object} geojson GeoJSON object.
 * @return {Object} Normalized Feature.
 */
function asFeature(geojson) {
  if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
    return geojson;
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: geojson,
  };
}

// Add toGeoJSON methods to layer classes
/**
 * Point-based layers to GeoJSON.
 * @type {!Object}
 */
const PointToGeoJSON = {
  /**
   * Exports layer as GeoJSON Point.
   * @param {number=} precision Coordinate precision.
   * @return {Object} GeoJSON Feature.
   */
  toGeoJSON: function(precision) {
    return getFeature(this, {
      type: 'Point',
      coordinates: latLngToCoords(this.getLatLng(), precision),
    });
  },
};

Marker.include(PointToGeoJSON);
Circle.include(PointToGeoJSON);
CircleMarker.include(PointToGeoJSON);

Polyline.include({
  /**
   * Exports layer as GeoJSON LineString/MultiLineString.
   * @param {number=} precision Coordinate precision.
   * @return {Object} GeoJSON Feature.
   */
  toGeoJSON: function(precision) {
    const multi = !isFlat(this._latlngs);
    const coords = latLngsToCoords(this._latlngs, multi ? 1 : 0, false, precision);
    return getFeature(this, {
      type: (multi ? 'Multi' : '') + 'LineString',
      coordinates: coords,
    });
  },
});

Polygon.include({
  /**
   * Exports layer as GeoJSON Polygon/MultiPolygon.
   * @param {number=} precision Coordinate precision.
   * @return {Object} GeoJSON Feature.
   */
  toGeoJSON: function(precision) {
    const holes = !isFlat(this._latlngs);
    const multi = holes && !isFlat(this._latlngs[0]);
    const coords = latLngsToCoords(this._latlngs, multi ? 2 : holes ? 1 : 0, true, precision);
    if (!holes) {
      coords = [coords];
    }
    return getFeature(this, {
      type: (multi ? 'Multi' : '') + 'Polygon',
      coordinates: coords,
    });
  },
});

LayerGroup.include({
  /**
   * Exports as GeoJSON MultiPoint.
   * @param {number=} precision Coordinate precision.
   * @return {Object} GeoJSON Feature.
   */
  toMultiPoint: function(precision) {
    const coords = [];
    this.eachLayer(function(layer) {
      coords.push(layer.toGeoJSON(precision).geometry.coordinates);
    });
    return getFeature(this, {
      type: 'MultiPoint',
      coordinates: coords,
    });
  },

  /**
   * Exports layer group as GeoJSON.
   * @param {number=} precision Coordinate precision.
   * @return {Object} GeoJSON FeatureCollection or GeometryCollection.
   */
  toGeoJSON: function(precision) {
    const type = this.feature && this.feature.geometry && this.feature.geometry.type;
    if (type === 'MultiPoint') {
      return this.toMultiPoint(precision);
    }
    const isGeometryCollection = type === 'GeometryCollection';
    const jsons = [];
    this.eachLayer(function(layer) {
      if (layer.toGeoJSON) {
        const json = layer.toGeoJSON(precision);
        if (isGeometryCollection) {
          jsons.push(json.geometry);
        } else {
          const feature = asFeature(json);
          if (feature.type === 'FeatureCollection') {
            jsons.push.apply(jsons, feature.features);
          } else {
            jsons.push(feature);
          }
        }
      }
    });
    if (isGeometryCollection) {
      return getFeature(this, {
        geometries: jsons,
        type: 'GeometryCollection',
      });
    }
    return {
      type: 'FeatureCollection',
      features: jsons,
    };
  },
});

/**
 * Creates a GeoJSON layer.
 * @param {Object|Array<Object>} geojson GeoJSON data.
 * @param {Object=} options Layer options.
 * @return {!GeoJSON} New GeoJSON layer.
 */
function geoJSON(geojson, options) {
  return new GeoJSON(geojson, options);
}

// Export GeoJSON utilities
GeoJSON.geometryToLayer = geometryToLayer;
GeoJSON.coordsToLatLng = coordsToLatLng;
GeoJSON.coordsToLatLngs = coordsToLatLngs;
GeoJSON.latLngToCoords = latLngToCoords;
GeoJSON.latLngsToCoords = latLngsToCoords;
GeoJSON.getFeature = getFeature;
GeoJSON.asFeature = asFeature;
