/**
 * Represents a point with x and y coordinates.
 */
class Point {
  /**
   * @param {number} x X coordinate.
   * @param {number} y Y coordinate.
   * @param {boolean=} round Whether to round coordinates.
   */
  constructor(x, y, round) {
    this.x = round ? Math.round(x) : x;
    this.y = round ? Math.round(y) : y;
  }

  /**
   * Returns a clone of the point.
   * @return {!Point} Cloned point.
   */
  clone() {
    return new Point(this.x, this.y);
  }

  /**
   * Adds another point and returns a new point.
   * @param {!Point|number[]} point Point to add.
   * @return {!Point} New point.
   */
  add(point) {
    return this.clone()._add(toPoint(point));
  }

  /**
   * Adds another point in place.
   * @param {!Point} point Point to add.
   * @return {!Point} This point.
   * @private
   */
  _add(point) {
    this.x += point.x;
    this.y += point.y;
    return this;
  }

  /**
   * Subtracts another point and returns a new point.
   * @param {!Point|number[]} point Point to subtract.
   * @return {!Point} New point.
   */
  subtract(point) {
    return this.clone()._subtract(toPoint(point));
  }

  /**
   * Subtracts another point in place.
   * @param {!Point} point Point to subtract.
   * @return {!Point} This point.
   * @private
   */
  _subtract(point) {
    this.x -= point.x;
    this.y -= point.y;
    return this;
  }

  /**
   * Divides by a number and returns a new point.
   * @param {number} num Divisor.
   * @return {!Point} New point.
   */
  divideBy(num) {
    return this.clone()._divideBy(num);
  }

  /**
   * Divides by a number in place.
   * @param {number} num Divisor.
   * @return {!Point} This point.
   * @private
   */
  _divideBy(num) {
    this.x /= num;
    this.y /= num;
    return this;
  }

  /**
   * Multiplies by a number and returns a new point.
   * @param {number} num Multiplier.
   * @return {!Point} New point.
   */
  multiplyBy(num) {
    return this.clone()._multiplyBy(num);
  }

  /**
   * Multiplies by a number in place.
   * @param {number} num Multiplier.
   * @return {!Point} This point.
   * @private
   */
  _multiplyBy(num) {
    this.x *= num;
    this.y *= num;
    return this;
  }

  /**
   * Scales by another point.
   * @param {!Point} point Scale point.
   * @return {!Point} New scaled point.
   */
  scaleBy(point) {
    return new Point(this.x * point.x, this.y * point.y);
  }

  /**
   * Unscales by another point.
   * @param {!Point} point Scale point.
   * @return {!Point} New unscaled point.
   */
  unscaleBy(point) {
    return new Point(this.x / point.x, this.y / point.y);
  }

  /**
   * Rounds coordinates and returns a new point.
   * @return {!Point} Rounded point.
   */
  round() {
    return this.clone()._round();
  }

  /**
   * Rounds coordinates in place.
   * @return {!Point} This point.
   * @private
   */
  _round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }

  /**
   * Floors coordinates and returns a new point.
   * @return {!Point} Floored point.
   */
  floor() {
    return this.clone()._floor();
  }

  /**
   * Floors coordinates in place.
   * @return {!Point} This point.
   * @private
   */
  _floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }

  /**
   * Ceils coordinates and returns a new point.
   * @return {!Point} Ceiled point.
   */
  ceil() {
    return this.clone()._ceil();
  }

  /**
   * Ceils coordinates in place.
   * @return {!Point} This point.
   * @private
   */
  _ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }

  /**
   * Truncates coordinates and returns a new point.
   * @return {!Point} Truncated point.
   */
  trunc() {
    return this.clone()._trunc();
  }

  /**
   * Truncates coordinates in place.
   * @return {!Point} This point.
   * @private
   */
  _trunc() {
    this.x = trunc(this.x);
    this.y = trunc(this.y);
    return this;
  }

  /**
   * Calculates distance to another point.
   * @param {!Point|number[]} point Target point.
   * @return {number} Distance.
   */
  distanceTo(point) {
    point = toPoint(point);
    const x = point.x - this.x;
    const y = point.y - this.y;
    return Math.sqrt(x * x + y * y);
  }

  /**
   * Checks equality with another point.
   * @param {!Point|number[]} point Point to compare.
   * @return {boolean} Whether equal.
   */
  equals(point) {
    point = toPoint(point);
    return point.x === this.x && point.y === this.y;
  }

  /**
   * Checks if this point contains another point.
   * @param {!Point|number[]} point Point to check.
   * @return {boolean} Whether contains.
   */
  contains(point) {
    point = toPoint(point);
    return Math.abs(point.x) <= Math.abs(this.x) &&
           Math.abs(point.y) <= Math.abs(this.y);
  }

  /**
   * Returns string representation.
   * @return {string} String representation.
   */
  toString() {
    return 'Point(' +
        formatNum(this.x) + ', ' +
        formatNum(this.y) + ')';
  }
}

/**
 * Truncates a number.
 * @param {number} v Value to truncate.
 * @return {number} Truncated value.
 */
const trunc = Math.trunc || function(v) {
  return v > 0 ? Math.floor(v) : Math.ceil(v);
};

/**
 * Creates a Point from various input types.
 * @param {number|number[]|Point|Object} x X coordinate or object.
 * @param {number=} y Y coordinate.
 * @param {boolean=} round Whether to round.
 * @return {Point} Created point.
 */
function toPoint(x, y, round) {
  if (x instanceof Point) {
    return x;
  }
  if (isArray(x)) {
    return new Point(x[0], x[1]);
  }
  if (x === undefined || x === null) {
    return x;
  }
  if (typeof x === 'object' && 'x' in x && 'y' in x) {
    return new Point(x.x, x.y);
  }
  return new Point(x, y, round);
}

/**
 * Represents a rectangular bounds with min and max points.
 */
class Bounds {
  /**
   * @param {Point[]|Point|Bounds} a First point or array of points.
   * @param {Point=} b Second point (if a is a point).
   */
  constructor(a, b) {
    if (!a) {
      return;
    }
    const points = b ? [a, b] : a;
    for (let i = 0, len = points.length; i < len; i++) {
      this.extend(points[i]);
    }
  }

  /**
   * Extends bounds to include a point or bounds.
   * @param {Point|Bounds|number[]} obj Object to include.
   * @return {!Bounds} This bounds.
   */
  extend(obj) {
    let min2, max2;
    if (!obj) {
      return this;
    }
    if (obj instanceof Point || typeof obj[0] === 'number' || 'x' in obj) {
      min2 = max2 = toPoint(obj);
    } else {
      obj = toBounds(obj);
      min2 = obj.min;
      max2 = obj.max;
      if (!min2 || !max2) {
        return this;
      }
    }
    if (!this.min && !this.max) {
      this.min = min2.clone();
      this.max = max2.clone();
    } else {
      this.min.x = Math.min(min2.x, this.min.x);
      this.max.x = Math.max(max2.x, this.max.x);
      this.min.y = Math.min(min2.y, this.min.y);
      this.max.y = Math.max(max2.y, this.max.y);
    }
    return this;
  }

  /**
   * Gets center point.
   * @param {boolean=} round Whether to round.
   * @return {!Point} Center point.
   */
  getCenter(round) {
    return toPoint(
        (this.min.x + this.max.x) / 2,
        (this.min.y + this.max.y) / 2, round);
  }

  /**
   * Gets bottom-left point.
   * @return {!Point} Bottom-left point.
   */
  getBottomLeft() {
    return toPoint(this.min.x, this.max.y);
  }

  /**
   * Gets top-right point.
   * @return {!Point} Top-right point.
   */
  getTopRight() {
    return toPoint(this.max.x, this.min.y);
  }

  /**
   * Gets top-left point.
   * @return {!Point} Top-left point.
   */
  getTopLeft() {
    return this.min;
  }

  /**
   * Gets bottom-right point.
   * @return {!Point} Bottom-right point.
   */
  getBottomRight() {
    return this.max;
  }

  /**
   * Gets size as a point.
   * @return {!Point} Size point.
   */
  getSize() {
    return this.max.subtract(this.min);
  }

  /**
   * Checks if bounds contains a point or bounds.
   * @param {Point|Bounds|number[]} obj Object to check.
   * @return {boolean} Whether contains.
   */
  contains(obj) {
    let min, max;
    if (typeof obj[0] === 'number' || obj instanceof Point) {
      obj = toPoint(obj);
    } else {
      obj = toBounds(obj);
    }
    if (obj instanceof Bounds) {
      min = obj.min;
      max = obj.max;
    } else {
      min = max = obj;
    }
    return (min.x >= this.min.x) &&
           (max.x <= this.max.x) &&
           (min.y >= this.min.y) &&
           (max.y <= this.max.y);
  }

  /**
   * Checks if bounds intersects with another bounds.
   * @param {Bounds} bounds Bounds to check.
   * @return {boolean} Whether intersects.
   */
  intersects(bounds) {
    bounds = toBounds(bounds);
    const min = this.min;
    const max = this.max;
    const min2 = bounds.min;
    const max2 = bounds.max;
    const xIntersects = (max2.x >= min.x) && (min2.x <= max.x);
    const yIntersects = (max2.y >= min.y) && (min2.y <= max.y);
    return xIntersects && yIntersects;
  }

  /**
   * Checks if bounds overlaps with another bounds.
   * @param {Bounds} bounds Bounds to check.
   * @return {boolean} Whether overlaps.
   */
  overlaps(bounds) {
    bounds = toBounds(bounds);
    const min = this.min;
    const max = this.max;
    const min2 = bounds.min;
    const max2 = bounds.max;
    const xOverlaps = (max2.x > min.x) && (min2.x < max.x);
    const yOverlaps = (max2.y > min.y) && (min2.y < max.y);
    return xOverlaps && yOverlaps;
  }

  /**
   * Checks if bounds is valid.
   * @return {boolean} Whether valid.
   */
  isValid() {
    return !!(this.min && this.max);
  }

  /**
   * Pads bounds by a buffer ratio.
   * @param {number} bufferRatio Buffer ratio.
   * @return {!Bounds} Padded bounds.
   */
  pad(bufferRatio) {
    const min = this.min;
    const max = this.max;
    const heightBuffer = Math.abs(min.x - max.x) * bufferRatio;
    const widthBuffer = Math.abs(min.y - max.y) * bufferRatio;
    return toBounds(
        toPoint(min.x - heightBuffer, min.y - widthBuffer),
        toPoint(max.x + heightBuffer, max.y + widthBuffer));
  }

  /**
   * Checks equality with another bounds.
   * @param {Bounds} bounds Bounds to compare.
   * @return {boolean} Whether equal.
   */
  equals(bounds) {
    if (!bounds) {
      return false;
    }
    bounds = toBounds(bounds);
    return this.min.equals(bounds.getTopLeft()) &&
        this.max.equals(bounds.getBottomRight());
  }
}

/**
 * Creates Bounds from various input types.
 * @param {Point[]|Point|Bounds} a First point or array of points.
 * @param {Point=} b Second point (if a is a point).
 * @return {Bounds} Created bounds.
 */
function toBounds(a, b) {
  if (!a || a instanceof Bounds) {
    return a;
  }
  return new Bounds(a, b);
}

/**
 * Represents a geographical coordinate (latitude, longitude).
 */
class LatLng {
  /**
   * @param {number} lat Latitude.
   * @param {number} lng Longitude.
   * @param {number=} alt Altitude.
   */
  constructor(lat, lng, alt) {
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
    }
    this.lat = +lat;
    this.lng = +lng;
    if (alt !== undefined) {
      this.alt = +alt;
    }
  }

  /**
   * Checks equality with another LatLng.
   * @param {LatLng|Object} obj Object to compare.
   * @param {number=} maxMargin Maximum margin for equality.
   * @return {boolean} Whether equal.
   */
  equals(obj, maxMargin) {
    if (!obj) {
      return false;
    }
    obj = toLatLng(obj);
    const margin = Math.max(
        Math.abs(this.lat - obj.lat),
        Math.abs(this.lng - obj.lng));
    return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
  }

  /**
   * Returns string representation.
   * @param {number=} precision Precision for formatting.
   * @return {string} String representation.
   */
  toString(precision) {
    return 'LatLng(' +
        formatNum(this.lat, precision) + ', ' +
        formatNum(this.lng, precision) + ')';
  }

  /**
   * Calculates distance to another LatLng.
   * @param {LatLng|Object} other Target LatLng.
   * @return {number} Distance in meters.
   */
  distanceTo(other) {
    return Earth.distance(this, toLatLng(other));
  }

  /**
   * Wraps longitude to [-180, 180] range.
   * @return {!LatLng} Wrapped LatLng.
   */
  wrap() {
    return Earth.wrapLatLng(this);
  }

  /**
   * Creates bounds around this point.
   * @param {number} sizeInMeters Size in meters.
   * @return {!LatLngBounds} Bounds.
   */
  toBounds(sizeInMeters) {
    const latAccuracy = 180 * sizeInMeters / 40075017;
    const lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);
    return toLatLngBounds(
        [this.lat - latAccuracy, this.lng - lngAccuracy],
        [this.lat + latAccuracy, this.lng + lngAccuracy]);
  }

  /**
   * Returns a clone of this LatLng.
   * @return {!LatLng} Cloned LatLng.
   */
  clone() {
    return new LatLng(this.lat, this.lng, this.alt);
  }
}

/**
 * Creates LatLng from various input types.
 * @param {number|number[]|LatLng|Object} a Latitude or array/object.
 * @param {number=} b Longitude.
 * @param {number=} c Altitude.
 * @return {LatLng} Created LatLng.
 */
function toLatLng(a, b, c) {
  if (a instanceof LatLng) {
    return a;
  }
  if (isArray(a) && typeof a[0] !== 'object') {
    if (a.length === 3) {
      return new LatLng(a[0], a[1], a[2]);
    }
    if (a.length === 2) {
      return new LatLng(a[0], a[1]);
    }
    return null;
  }
  if (a === undefined || a === null) {
    return a;
  }
  if (typeof a === 'object' && 'lat' in a) {
    return new LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
  }
  if (b === undefined) {
    return null;
  }
  return new LatLng(a, b, c);
}

/**
 * Represents geographical bounds with southwest and northeast corners.
 */
class LatLngBounds {
  /**
   * @param {LatLng[]|LatLng|LatLngBounds} corner1 First corner or array.
   * @param {LatLng=} corner2 Second corner (if corner1 is a LatLng).
   */
  constructor(corner1, corner2) {
    if (!corner1) {
      return;
    }
    const latlngs = corner2 ? [corner1, corner2] : corner1;
    for (let i = 0, len = latlngs.length; i < len; i++) {
      this.extend(latlngs[i]);
    }
  }

  /**
   * Extends bounds to include a LatLng or LatLngBounds.
   * @param {LatLng|LatLngBounds|Object} obj Object to include.
   * @return {!LatLngBounds} This bounds.
   */
  extend(obj) {
    let sw = this._southWest;
    let ne = this._northEast;
    let sw2, ne2;
    if (obj instanceof LatLng) {
      sw2 = obj;
      ne2 = obj;
    } else if (obj instanceof LatLngBounds) {
      sw2 = obj._southWest;
      ne2 = obj._northEast;
      if (!sw2 || !ne2) {
        return this;
      }
    } else {
      return obj ? this.extend(toLatLng(obj) || toLatLngBounds(obj)) : this;
    }
    if (!sw && !ne) {
      this._southWest = new LatLng(sw2.lat, sw2.lng);
      this._northEast = new LatLng(ne2.lat, ne2.lng);
    } else {
      sw.lat = Math.min(sw2.lat, sw.lat);
      sw.lng = Math.min(sw2.lng, sw.lng);
      ne.lat = Math.max(ne2.lat, ne.lat);
      ne.lng = Math.max(ne2.lng, ne.lng);
    }
    return this;
  }

  /**
   * Pads bounds by a buffer ratio.
   * @param {number} bufferRatio Buffer ratio.
   * @return {!LatLngBounds} Padded bounds.
   */
  pad(bufferRatio) {
    const sw = this._southWest;
    const ne = this._northEast;
    const heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio;
    const widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;
    return new LatLngBounds(
        new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
        new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
  }

  /**
   * Gets center LatLng.
   * @return {!LatLng} Center.
   */
  getCenter() {
    return new LatLng(
        (this._southWest.lat + this._northEast.lat) / 2,
        (this._southWest.lng + this._northEast.lng) / 2);
  }

  /**
   * Gets southwest corner.
   * @return {!LatLng} Southwest corner.
   */
  getSouthWest() {
    return this._southWest;
  }

  /**
   * Gets northeast corner.
   * @return {!LatLng} Northeast corner.
   */
  getNorthEast() {
    return this._northEast;
  }

  /**
   * Gets northwest corner.
   * @return {!LatLng} Northwest corner.
   */
  getNorthWest() {
    return new LatLng(this.getNorth(), this.getWest());
  }

  /**
   * Gets southeast corner.
   * @return {!LatLng} Southeast corner.
   */
  getSouthEast() {
    return new LatLng(this.getSouth(), this.getEast());
  }

  /**
   * Gets west longitude.
   * @return {number} West longitude.
   */
  getWest() {
    return this._southWest.lng;
  }

  /**
   * Gets south latitude.
   * @return {number} South latitude.
   */
  getSouth() {
    return this._southWest.lat;
  }

  /**
   * Gets east longitude.
   * @return {number} East longitude.
   */
  getEast() {
    return this._northEast.lng;
  }

  /**
   * Gets north latitude.
   * @return {number} North latitude.
   */
  getNorth() {
    return this._northEast.lat;
  }

  /**
   * Checks if bounds contains a LatLng or LatLngBounds.
   * @param {LatLng|LatLngBounds|Object} obj Object to check.
   * @return {boolean} Whether contains.
   */
  contains(obj) {
    if (typeof obj[0] === 'number' || obj instanceof LatLng || 'lat' in obj) {
      obj = toLatLng(obj);
    } else {
      obj = toLatLngBounds(obj);
    }
    let sw = this._southWest;
    let ne = this._northEast;
    let sw2, ne2;
    if (obj instanceof LatLngBounds) {
      sw2 = obj.getSouthWest();
      ne2 = obj.getNorthEast();
    } else {
      sw2 = ne2 = obj;
    }
    return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
           (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
  }

  /**
   * Checks if bounds intersects with another bounds.
   * @param {LatLngBounds} bounds Bounds to check.
   * @return {boolean} Whether intersects.
   */
  intersects(bounds) {
    bounds = toLatLngBounds(bounds);
    const sw = this._southWest;
    const ne = this._northEast;
    const sw2 = bounds.getSouthWest();
    const ne2 = bounds.getNorthEast();
    const latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat);
    const lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);
    return latIntersects && lngIntersects;
  }

  /**
   * Checks if bounds overlaps with another bounds.
   * @param {LatLngBounds} bounds Bounds to check.
   * @return {boolean} Whether overlaps.
   */
  overlaps(bounds) {
    bounds = toLatLngBounds(bounds);
    const sw = this._southWest;
    const ne = this._northEast;
    const sw2 = bounds.getSouthWest();
    const ne2 = bounds.getNorthEast();
    const latOverlaps = (ne2.lat > sw.lat) && (sw2.lat < ne.lat);
    const lngOverlaps = (ne2.lng > sw.lng) && (sw2.lng < ne.lng);
    return latOverlaps && lngOverlaps;
  }

  /**
   * Converts to BBox string.
   * @return {string} BBox string.
   */
  toBBoxString() {
    return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
  }

  /**
   * Checks equality with another bounds.
   * @param {LatLngBounds} bounds Bounds to compare.
   * @param {number=} maxMargin Maximum margin for equality.
   * @return {boolean} Whether equal.
   */
  equals(bounds, maxMargin) {
    if (!bounds) {
      return false;
    }
    bounds = toLatLngBounds(bounds);
    return this._southWest.equals(bounds.getSouthWest(), maxMargin) &&
           this._northEast.equals(bounds.getNorthEast(), maxMargin);
  }

  /**
   * Checks if bounds is valid.
   * @return {boolean} Whether valid.
   */
  isValid() {
    return !!(this._southWest && this._northEast);
  }
}

/**
 * Creates LatLngBounds from various input types.
 * @param {LatLng[]|LatLng|LatLngBounds} a First corner or array.
 * @param {LatLng=} b Second corner (if a is a LatLng).
 * @return {LatLngBounds} Created bounds.
 */
function toLatLngBounds(a, b) {
  if (a instanceof LatLngBounds) {
    return a;
  }
  return new LatLngBounds(a, b);
}
