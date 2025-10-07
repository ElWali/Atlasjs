/**
 * Represents an affine transformation for coordinate projections.
 */
class Transformation {
  /**
   * @param {number|number[]} a Scale factor for x or array [a, b, c, d].
   * @param {number=} b Translate factor for x.
   * @param {number=} c Scale factor for y.
   * @param {number=} d Translate factor for y.
   */
  constructor(a, b, c, d) {
    if (isArray(a)) {
      this._a = a[0];
      this._b = a[1];
      this._c = a[2];
      this._d = a[3];
      return;
    }
    this._a = a;
    this._b = b;
    this._c = c;
    this._d = d;
  }

  /**
   * Transforms a point with optional scale.
   * @param {!Point} point Point to transform.
   * @param {number=} scale Scale factor.
   * @return {!Point} Transformed point.
   */
  transform(point, scale) {
    return this._transform(point.clone(), scale);
  }

  /**
   * Transforms a point in place.
   * @param {!Point} point Point to transform.
   * @param {number=} scale Scale factor.
   * @return {!Point} Transformed point.
   * @private
   */
  _transform(point, scale) {
    scale = scale || 1;
    point.x = scale * (this._a * point.x + this._b);
    point.y = scale * (this._c * point.y + this._d);
    return point;
  }

  /**
   * Untransforms a point with optional scale.
   * @param {!Point} point Point to untransform.
   * @param {number=} scale Scale factor.
   * @return {!Point} Untransformed point.
   */
  untransform(point, scale) {
    scale = scale || 1;
    return new Point(
        (point.x / scale - this._b) / this._a,
        (point.y / scale - this._d) / this._c);
  }
}

/**
 * Creates a Transformation from parameters.
 * @param {number} a Scale x.
 * @param {number} b Translate x.
 * @param {number} c Scale y.
 * @param {number} d Translate y.
 * @return {!Transformation} New transformation.
 */
function toTransformation(a, b, c, d) {
  return new Transformation(a, b, c, d);
}

/**
 * Base Coordinate Reference System.
 * @type {!Object}
 */
const CRS = {
  /**
   * Converts LatLng to Point at given zoom.
   * @param {!LatLng} latlng Latitude/longitude.
   * @param {number} zoom Zoom level.
   * @return {!Point} Pixel point.
   */
  latLngToPoint: function(latlng, zoom) {
    const projectedPoint = this.projection.project(latlng);
    const scale = this.scale(zoom);
    return this.transformation._transform(projectedPoint, scale);
  },

  /**
   * Converts Point to LatLng at given zoom.
   * @param {!Point} point Pixel point.
   * @param {number} zoom Zoom level.
   * @return {!LatLng} Latitude/longitude.
   */
  pointToLatLng: function(point, zoom) {
    const scale = this.scale(zoom);
    const untransformedPoint = this.transformation.untransform(point, scale);
    return this.projection.unproject(untransformedPoint);
  },

  /**
   * Projects LatLng to CRS coordinates.
   * @param {!LatLng} latlng Latitude/longitude.
   * @return {!Point} Projected point.
   */
  project: function(latlng) {
    return this.projection.project(latlng);
  },

  /**
   * Unprojects CRS coordinates to LatLng.
   * @param {!Point} point Projected point.
   * @return {!LatLng} Latitude/longitude.
   */
  unproject: function(point) {
    return this.projection.unproject(point);
  },

  /**
   * Gets scale for zoom level.
   * @param {number} zoom Zoom level.
   * @return {number} Scale.
   */
  scale: function(zoom) {
    return 256 * Math.pow(2, zoom);
  },

  /**
   * Gets zoom from scale.
   * @param {number} scale Scale.
   * @return {number} Zoom level.
   */
  zoom: function(scale) {
    return Math.log(scale / 256) / Math.LN2;
  },

  /**
   * Gets projected bounds for zoom level.
   * @param {number} zoom Zoom level.
   * @return {Bounds|undefined} Bounds or null if infinite.
   */
  getProjectedBounds: function(zoom) {
    if (this.infinite) {
      return null;
    }
    const b = this.projection.bounds;
    const s = this.scale(zoom);
    const min = this.transformation.transform(b.min, s);
    const max = this.transformation.transform(b.max, s);
    return new Bounds(min, max);
  },

  /** @type {boolean} Whether CRS is infinite. */
  infinite: false,

  /**
   * Wraps LatLng to valid range.
   * @param {!LatLng} latlng Latitude/longitude.
   * @return {!LatLng} Wrapped LatLng.
   */
  wrapLatLng: function(latlng) {
    const lng = this.wrapLng ? wrapNum(latlng.lng, this.wrapLng, true) : latlng.lng;
    const lat = this.wrapLat ? wrapNum(latlng.lat, this.wrapLat, true) : latlng.lat;
    const alt = latlng.alt;
    return new LatLng(lat, lng, alt);
  },

  /**
   * Wraps LatLngBounds to valid range.
   * @param {!LatLngBounds} bounds Bounds to wrap.
   * @return {!LatLngBounds} Wrapped bounds.
   */
  wrapLatLngBounds: function(bounds) {
    const center = bounds.getCenter();
    const newCenter = this.wrapLatLng(center);
    const latShift = center.lat - newCenter.lat;
    const lngShift = center.lng - newCenter.lng;
    if (latShift === 0 && lngShift === 0) {
      return bounds;
    }
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const newSw = new LatLng(sw.lat - latShift, sw.lng - lngShift);
    const newNe = new LatLng(ne.lat - latShift, ne.lng - lngShift);
    return new LatLngBounds(newSw, newNe);
  },
};

/**
 * Earth CRS with spherical distance calculation.
 * @type {!Object}
 */
const Earth = extend({}, CRS, {
  /** @type {Array<number>} Longitude wrap range [-180, 180]. */
  wrapLng: [-180, 180],

  /** @type {number} Earth radius in meters. */
  R: 6371000,

  /**
   * Calculates great-circle distance between two points.
   * @param {!LatLng} latlng1 First point.
   * @param {!LatLng} latlng2 Second point.
   * @return {number} Distance in meters.
   */
  distance: function(latlng1, latlng2) {
    const rad = Math.PI / 180;
    const lat1 = latlng1.lat * rad;
    const lat2 = latlng2.lat * rad;
    const sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2);
    const sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2);
    const a = sinDLat * sinDLat +
        Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.R * c;
  },
});

/** @type {number} Earth radius used in SphericalMercator. */
const earthRadius = 6378137;

/**
 * Spherical Mercator projection.
 * @type {!Object}
 */
const SphericalMercator = {
  /** @type {number} Earth radius. */
  R: earthRadius,

  /** @type {number} Maximum latitude (85.0511287798°). */
  MAX_LATITUDE: 85.0511287798,

  /**
   * Projects LatLng to Point.
   * @param {!LatLng} latlng Latitude/longitude.
   * @return {!Point} Projected point.
   */
  project: function(latlng) {
    const d = Math.PI / 180;
    const max = this.MAX_LATITUDE;
    const lat = Math.max(Math.min(max, latlng.lat), -max);
    const sin = Math.sin(lat * d);
    return new Point(
        this.R * latlng.lng * d,
        this.R * Math.log((1 + sin) / (1 - sin)) / 2);
  },

  /**
   * Unprojects Point to LatLng.
   * @param {!Point} point Projected point.
   * @return {!LatLng} Latitude/longitude.
   */
  unproject: function(point) {
    const d = 180 / Math.PI;
    return new LatLng(
        (2 * Math.atan(Math.exp(point.y / this.R)) - (Math.PI / 2)) * d,
        point.x * d / this.R);
  },

  /**
   * Gets projection bounds.
   * @return {!Bounds} Bounds.
   * @private
   */
  get bounds() {
    const d = earthRadius * Math.PI;
    return new Bounds([-d, -d], [d, d]);
  },
};

/**
 * EPSG:3857 CRS (Web Mercator).
 * @type {!Object}
 */
const EPSG3857 = extend({}, Earth, {
  /** @type {string} CRS code. */
  code: 'EPSG:3857',

  /** @type {!Object} Projection. */
  projection: SphericalMercator,

  /**
   * Gets transformation.
   * @return {!Transformation} Transformation.
   * @private
   */
  get transformation() {
    const scale = 0.5 / (Math.PI * SphericalMercator.R);
    return toTransformation(scale, 0.5, -scale, 0.5);
  },
});

/**
 * EPSG:900913 CRS (legacy Web Mercator alias).
 * @type {!Object}
 */
const EPSG900913 = extend({}, EPSG3857, {
  /** @type {string} CRS code. */
  code: 'EPSG:900913',
});

// Export CRS constants for Section 4
// (Will be used in later sections)
