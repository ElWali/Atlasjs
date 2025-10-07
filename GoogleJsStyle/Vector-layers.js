/**
 * Base class for vector layers.
 * @extends {Layer}
 */
const Path = Layer.extend(/** @lends Path.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    stroke: true,
    color: '#3388ff',
    weight: 3,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: null,
    dashOffset: null,
    fill: false,
    fillColor: null,
    fillOpacity: 0.2,
    fillRule: 'evenodd',
    interactive: true,
    bubblingMouseEvents: true,
  },

  /**
   * Called before adding to map.
   * @param {!Map} map Map instance.
   */
  beforeAdd: function(map) {
    this._renderer = map.getRenderer(this);
  },

  /**
   * Called when added to map.
   */
  onAdd: function() {
    this._renderer._initPath(this);
    this._reset();
    this._renderer._addPath(this);
  },

  /**
   * Called when removed from map.
   */
  onRemove: function() {
    this._renderer._removePath(this);
  },

  /**
   * Redraws the path.
   * @return {!Path} This path.
   */
  redraw: function() {
    if (this._map) {
      this._renderer._updatePath(this);
    }
    return this;
  },

  /**
   * Sets path style.
   * @param {!Object} style Style options.
   * @return {!Path} This path.
   */
  setStyle: function(style) {
    setOptions(this, style);
    if (this._renderer) {
      this._renderer._updateStyle(this);
      if (this.options.stroke && style && Object.prototype.hasOwnProperty.call(style, 'weight')) {
        this._updateBounds();
      }
    }
    return this;
  },

  /**
   * Brings path to front.
   * @return {!Path} This path.
   */
  bringToFront: function() {
    if (this._renderer) {
      this._renderer._bringToFront(this);
    }
    return this;
  },

  /**
   * Brings path to back.
   * @return {!Path} This path.
   */
  bringToBack: function() {
    if (this._renderer) {
      this._renderer._bringToBack(this);
    }
    return this;
  },

  /**
   * Gets path element.
   * @return {Element} Path element.
   */
  getElement: function() {
    return this._path;
  },

  /**
   * Resets path state.
   * @private
   */
  _reset: function() {
    this._project();
    this._update();
  },

  /**
   * Gets click tolerance.
   * @return {number} Tolerance in pixels.
   * @private
   */
  _clickTolerance: function() {
    return (this.options.stroke ? this.options.weight / 2 : 0) +
        (this._renderer.options.tolerance || 0);
  },
});

/**
 * Circle marker with fixed radius in pixels.
 * @extends {Path}
 */
const CircleMarker = Path.extend(/** @lends CircleMarker.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    fill: true,
    radius: 10,
  },

  /**
   * @param {!LatLng|number[]} latlng Latitude/longitude.
   * @param {Object=} options Options.
   */
  initialize: function(latlng, options) {
    setOptions(this, options);
    this._latlng = toLatLng(latlng);
    this._radius = this.options.radius;
  },

  /**
   * Sets marker latitude/longitude.
   * @param {!LatLng|number[]} latlng New position.
   * @return {!CircleMarker} This marker.
   */
  setLatLng: function(latlng) {
    const oldLatLng = this._latlng;
    this._latlng = toLatLng(latlng);
    this.redraw();
    return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
  },

  /**
   * Gets marker latitude/longitude.
   * @return {!LatLng} Position.
   */
  getLatLng: function() {
    return this._latlng;
  },

  /**
   * Sets marker radius.
   * @param {number} radius Radius in pixels.
   * @return {!CircleMarker} This marker.
   */
  setRadius: function(radius) {
    this.options.radius = this._radius = radius;
    return this.redraw();
  },

  /**
   * Gets marker radius.
   * @return {number} Radius in pixels.
   */
  getRadius: function() {
    return this._radius;
  },

  /**
   * Sets style with radius preservation.
   * @param {!Object} options Style options.
   * @return {!CircleMarker} This marker.
   */
  setStyle: function(options) {
    const radius = options && options.radius || this._radius;
    Path.prototype.setStyle.call(this, options);
    this.setRadius(radius);
    return this;
  },

  /**
   * Projects coordinates to pixel space.
   * @private
   */
  _project: function() {
    this._point = this._map.latLngToLayerPoint(this._latlng);
    this._updateBounds();
  },

  /**
   * Updates pixel bounds.
   * @private
   */
  _updateBounds: function() {
    const r = this._radius;
    const r2 = this._radiusY || r;
    const w = this._clickTolerance();
    const p = [r + w, r2 + w];
    this._pxBounds = new Bounds(this._point.subtract(p), this._point.add(p));
  },

  /**
   * Updates path rendering.
   * @private
   */
  _update: function() {
    if (this._map) {
      this._updatePath();
    }
  },

  /**
   * Updates circle rendering.
   * @private
   */
  _updatePath: function() {
    this._renderer._updateCircle(this);
  },

  /**
   * Checks if circle is empty (outside view).
   * @return {boolean} Whether empty.
   * @private
   */
  _empty: function() {
    return this._radius && !this._renderer._bounds.intersects(this._pxBounds);
  },

  /**
   * Checks if point is inside circle.
   * @param {!Point} p Point to check.
   * @return {boolean} Whether contains point.
   * @private
   */
  _containsPoint: function(p) {
    return p.distanceTo(this._point) <= this._radius + this._clickTolerance();
  },
});

/**
 * Creates a circle marker.
 * @param {!LatLng|number[]} latlng Latitude/longitude.
 * @param {Object=} options Options.
 * @return {!CircleMarker} New circle marker.
 */
function circleMarker(latlng, options) {
  return new CircleMarker(latlng, options);
}

/**
 * Circle with radius in meters.
 * @extends {CircleMarker}
 */
const Circle = CircleMarker.extend(/** @lends Circle.prototype */ {
  /**
   * @param {!LatLng|number[]} latlng Latitude/longitude.
   * @param {number|Object=} options Radius or options.
   * @param {Object=} legacyOptions Legacy options (for backward compatibility).
   */
  initialize: function(latlng, options, legacyOptions) {
    if (typeof options === 'number') {
      options = extend({}, legacyOptions, {radius: options});
    }
    setOptions(this, options);
    this._latlng = toLatLng(latlng);
    if (isNaN(this.options.radius)) {
      throw new Error('Circle radius cannot be NaN');
    }
    this._mRadius = this.options.radius;
  },

  /**
   * Sets circle radius.
   * @param {number} radius Radius in meters.
   * @return {!Circle} This circle.
   */
  setRadius: function(radius) {
    this._mRadius = radius;
    return this.redraw();
  },

  /**
   * Gets circle radius.
   * @return {number} Radius in meters.
   */
  getRadius: function() {
    return this._mRadius;
  },

  /**
   * Gets circle bounds.
   * @return {!LatLngBounds} Bounds.
   */
  getBounds: function() {
    const half = [this._radius, this._radiusY || this._radius];
    return new LatLngBounds(
        this._map.layerPointToLatLng(this._point.subtract(half)),
        this._map.layerPointToLatLng(this._point.add(half)));
  },

  /**
   * Sets style (inherited from Path).
   * @param {!Object} options Style options.
   * @return {!Circle} This circle.
   */
  setStyle: Path.prototype.setStyle,

  /**
   * Projects coordinates using CRS distance calculation.
   * @private
   */
  _project: function() {
    const lng = this._latlng.lng;
    const lat = this._latlng.lat;
    const map = this._map;
    const crs = map.options.crs;

    if (crs.distance === Earth.distance) {
      const d = Math.PI / 180;
      const latR = (this._mRadius / Earth.R) / d;
      const top = map.project([lat + latR, lng]);
      const bottom = map.project([lat - latR, lng]);
      const p = top.add(bottom).divideBy(2);
      const lat2 = map.unproject(p).lat;
      const lngR = Math.acos((Math.cos(latR * d) - Math.sin(lat * d) * Math.sin(lat2 * d)) /
          (Math.cos(lat * d) * Math.cos(lat2 * d))) / d;
      if (isNaN(lngR) || lngR === 0) {
        lngR = latR / Math.cos(Math.PI / 180 * lat);
      }
      this._point = p.subtract(map.getPixelOrigin());
      this._radius = isNaN(lngR) ? 0 : p.x - map.project([lat2, lng - lngR]).x;
      this._radiusY = p.y - top.y;
    } else {
      const latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));
      this._point = map.latLngToLayerPoint(this._latlng);
      this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;
    }
    this._updateBounds();
  },
});

/**
 * Creates a circle.
 * @param {!LatLng|number[]} latlng Latitude/longitude.
 * @param {number|Object=} options Radius or options.
 * @param {Object=} legacyOptions Legacy options.
 * @return {!Circle} New circle.
 */
function circle(latlng, options, legacyOptions) {
  return new Circle(latlng, options, legacyOptions);
}

/**
 * Polyline (open path).
 * @extends {Path}
 */
const Polyline = Path.extend(/** @lends Polyline.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    smoothFactor: 1.0,
    noClip: false,
  },

  /**
   * @param {LatLng[][]|LatLng[]} latlngs Array of LatLng arrays.
   * @param {Object=} options Options.
   */
  initialize: function(latlngs, options) {
    setOptions(this, options);
    this._setLatLngs(latlngs);
  },

  /**
   * Gets polyline coordinates.
   * @return {LatLng[][]|LatLng[]} Coordinates.
   */
  getLatLngs: function() {
    return this._latlngs;
  },

  /**
   * Sets polyline coordinates.
   * @param {LatLng[][]|LatLng[]} latlngs New coordinates.
   * @return {!Polyline} This polyline.
   */
  setLatLngs: function(latlngs) {
    this._setLatLngs(latlngs);
    return this.redraw();
  },

  /**
   * Checks if polyline is empty.
   * @return {boolean} Whether empty.
   */
  isEmpty: function() {
    return !this._latlngs.length;
  },

  /**
   * Finds closest point on polyline to given point.
   * @param {!Point} p Point to check.
   * @return {Point} Closest point.
   */
  closestLayerPoint: function(p) {
    let minDistance = Infinity;
    let minPoint = null;
    const closest = _sqClosestPointOnSegment;
    let p1, p2;

    for (let j = 0, jLen = this._parts.length; j < jLen; j++) {
      const points = this._parts[j];
      for (let i = 1, len = points.length; i < len; i++) {
        p1 = points[i - 1];
        p2 = points[i];
        const sqDist = closest(p, p1, p2, true);
        if (sqDist < minDistance) {
          minDistance = sqDist;
          minPoint = closest(p, p1, p2);
        }
      }
    }
    if (minPoint) {
      minPoint.distance = Math.sqrt(minDistance);
    }
    return minPoint;
  },

  /**
   * Gets polyline center.
   * @return {!LatLng} Center.
   */
  getCenter: function() {
    if (!this._map) {
      throw new Error('Must add layer to map before using getCenter()');
    }
    return polylineCenter(this._defaultShape(), this._map.options.crs);
  },

  /**
   * Gets polyline bounds.
   * @return {!LatLngBounds} Bounds.
   */
  getBounds: function() {
    return this._bounds;
  },

  /**
   * Adds a LatLng to the polyline.
   * @param {!LatLng|number[]} latlng Point to add.
   * @param {LatLng[]=} latlngs Target array (defaults to main array).
   * @return {!Polyline} This polyline.
   */
  addLatLng: function(latlng, latlngs) {
    latlngs = latlngs || this._defaultShape();
    latlng = toLatLng(latlng);
    latlngs.push(latlng);
    this._bounds.extend(latlng);
    return this.redraw();
  },

  /**
   * Sets LatLng array.
   * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
   * @private
   */
  _setLatLngs: function(latlngs) {
    this._bounds = new LatLngBounds();
    this._latlngs = this._convertLatLngs(latlngs);
  },

  /**
   * Gets default shape (first ring).
   * @return {LatLng[]} Default shape.
   * @private
   */
  _defaultShape: function() {
    return isFlat(this._latlngs) ? this._latlngs : this._latlngs[0];
  },

  /**
   * Converts LatLng arrays to proper format.
   * @param {LatLng[][]|LatLng[]} latlngs Input coordinates.
   * @return {LatLng[][]|LatLng[]} Converted coordinates.
   * @private
   */
  _convertLatLngs: function(latlngs) {
    const result = [];
    const flat = isFlat(latlngs);
    for (let i = 0, len = latlngs.length; i < len; i++) {
      if (flat) {
        result[i] = toLatLng(latlngs[i]);
        this._bounds.extend(result[i]);
      } else {
        result[i] = this._convertLatLngs(latlngs[i]);
      }
    }
    return result;
  },

  /**
   * Projects coordinates to pixel space.
   * @private
   */
  _project: function() {
    const pxBounds = new Bounds();
    this._rings = [];
    this._projectLatlngs(this._latlngs, this._rings, pxBounds);
    if (this._bounds.isValid() && pxBounds.isValid()) {
      this._rawPxBounds = pxBounds;
      this._updateBounds();
    }
  },

  /**
   * Updates pixel bounds with tolerance.
   * @private
   */
  _updateBounds: function() {
    const w = this._clickTolerance();
    const p = new Point(w, w);
    if (!this._rawPxBounds) {
      return;
    }
    this._pxBounds = new Bounds([
      this._rawPxBounds.min.subtract(p),
      this._rawPxBounds.max.add(p),
    ]);
  },

  /**
   * Projects LatLng arrays recursively.
   * @param {LatLng[][]|LatLng[]} latlngs Input coordinates.
   * @param {Point[][]} result Output pixel coordinates.
   * @param {!Bounds} projectedBounds Bounds accumulator.
   * @private
   */
  _projectLatlngs: function(latlngs, result, projectedBounds) {
    const flat = latlngs[0] instanceof LatLng;
    const len = latlngs.length;
    let i, ring;
    if (flat) {
      ring = [];
      for (i = 0; i < len; i++) {
        ring[i] = this._map.latLngToLayerPoint(latlngs[i]);
        projectedBounds.extend(ring[i]);
      }
      result.push(ring);
    } else {
      for (i = 0; i < len; i++) {
        this._projectLatlngs(latlngs[i], result, projectedBounds);
      }
    }
  },

  /**
   * Clips points to renderer bounds.
   * @private
   */
  _clipPoints: function() {
    const bounds = this._renderer._bounds;
    this._parts = [];
    if (!this._pxBounds || !this._pxBounds.intersects(bounds)) {
      return;
    }
    if (this.options.noClip) {
      this._parts = this._rings;
      return;
    }
    const parts = this._parts;
    let i, j, k, len, len2, segment, points;
    for (i = 0, k = 0, len = this._rings.length; i < len; i++) {
      points = this._rings[i];
      for (j = 0, len2 = points.length; j < len2 - 1; j++) {
        segment = clipSegment(points[j], points[j + 1], bounds, j, true);
        if (!segment) {
          continue;
        }
        parts[k] = parts[k] || [];
        parts[k].push(segment[0]);
        if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
          parts[k].push(segment[1]);
          k++;
        }
      }
    }
  },

  /**
   * Simplifies points using Douglas-Peucker algorithm.
   * @private
   */
  _simplifyPoints: function() {
    const parts = this._parts;
    const tolerance = this.options.smoothFactor;
    for (let i = 0, len = parts.length; i < len; i++) {
      parts[i] = simplify(parts[i], tolerance);
    }
  },

  /**
   * Updates path rendering.
   * @private
   */
  _update: function() {
    if (!this._map) {
      return;
    }
    this._clipPoints();
    this._simplifyPoints();
    this._updatePath();
  },

  /**
   * Updates polyline rendering.
   * @private
   */
  _updatePath: function() {
    this._renderer._updatePoly(this);
  },

  /**
   * Checks if point is on polyline.
   * @param {!Point} p Point to check.
   * @param {boolean=} closed Whether to treat as closed.
   * @return {boolean} Whether contains point.
   * @private
   */
  _containsPoint: function(p, closed) {
    const i = 0;
    const j = 0;
    const k = 0;
    let len;
    let len2;
    let part;
    const w = this._clickTolerance();
    if (!this._pxBounds || !this._pxBounds.contains(p)) {
      return false;
    }
    for (i = 0, len = this._parts.length; i < len; i++) {
      part = this._parts[i];
      for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
        if (!closed && (j === 0)) {
          continue;
        }
        if (pointToSegmentDistance(p, part[k], part[j]) <= w) {
          return true;
        }
      }
    }
    return false;
  },
});

/**
 * Creates a polyline.
 * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
 * @param {Object=} options Options.
 * @return {!Polyline} New polyline.
 */
function polyline(latlngs, options) {
  return new Polyline(latlngs, options);
}

// Static property for backward compatibility
Polyline._flat = _flat;

/**
 * Polygon (closed path).
 * @extends {Polyline}
 */
const Polygon = Polyline.extend(/** @lends Polygon.prototype */ {
  /**
   * @type {!Object}
   */
  options: {
    fill: true,
  },

  /**
   * Checks if polygon is empty.
   * @return {boolean} Whether empty.
   */
  isEmpty: function() {
    return !this._latlngs.length || !this._latlngs[0].length;
  },

  /**
   * Gets polygon center.
   * @return {!LatLng} Center.
   */
  getCenter: function() {
    if (!this._map) {
      throw new Error('Must add layer to map before using getCenter()');
    }
    return polygonCenter(this._defaultShape(), this._map.options.crs);
  },

  /**
   * Converts LatLng arrays with automatic closing.
   * @param {LatLng[][]|LatLng[]} latlngs Input coordinates.
   * @return {LatLng[][]|LatLng[]} Converted coordinates.
   * @private
   */
  _convertLatLngs: function(latlngs) {
    const result = Polyline.prototype._convertLatLngs.call(this, latlngs);
    const len = result.length;
    if (len >= 2 && result[0] instanceof LatLng && result[0].equals(result[len - 1])) {
      result.pop();
    }
    return result;
  },

  /**
   * Sets LatLng array with proper nesting.
   * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
   * @private
   */
  _setLatLngs: function(latlngs) {
    Polyline.prototype._setLatLngs.call(this, latlngs);
    if (isFlat(this._latlngs)) {
      this._latlngs = [this._latlngs];
    }
  },

  /**
   * Gets default shape (first ring).
   * @return {LatLng[]} Default shape.
   * @private
   */
  _defaultShape: function() {
    return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
  },

  /**
   * Clips points using polygon clipping algorithm.
   * @private
   */
  _clipPoints: function() {
    const bounds = this._renderer._bounds;
    const w = this.options.weight;
    const p = new Point(w, w);
    const clippedBounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));
    this._parts = [];
    if (!this._pxBounds || !this._pxBounds.intersects(clippedBounds)) {
      return;
    }
    if (this.options.noClip) {
      this._parts = this._rings;
      return;
    }
    for (let i = 0, len = this._rings.length, clipped; i < len; i++) {
      clipped = clipPolygon(this._rings[i], clippedBounds, true);
      if (clipped.length) {
        this._parts.push(clipped);
      }
    }
  },

  /**
   * Updates polygon rendering.
   * @private
   */
  _updatePath: function() {
    this._renderer._updatePoly(this, true);
  },

  /**
   * Checks if point is inside polygon.
   * @param {!Point} p Point to check.
   * @return {boolean} Whether contains point.
   * @private
   */
  _containsPoint: function(p) {
    let inside = false;
    let part;
    let p1;
    let p2;
    let i;
    let j;
    let k;
    let len;
    let len2;
    if (!this._pxBounds || !this._pxBounds.contains(p)) {
      return false;
    }
    for (i = 0, len = this._parts.length; i < len; i++) {
      part = this._parts[i];
      for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
        p1 = part[j];
        p2 = part[k];
        if (((p1.y > p.y) !== (p2.y > p.y)) &&
            (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
          inside = !inside;
        }
      }
    }
    return inside || Polyline.prototype._containsPoint.call(this, p, true);
  },
});

/**
 * Creates a polygon.
 * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
 * @param {Object=} options Options.
 * @return {!Polygon} New polygon.
 */
function polygon(latlngs, options) {
  return new Polygon(latlngs, options);
}

/**
 * Rectangle (special case of polygon).
 * @extends {Polygon}
 */
const Rectangle = Polygon.extend(/** @lends Rectangle.prototype */ {
  /**
   * @param {!LatLngBounds|LatLng[]} latLngBounds Bounds or corner array.
   * @param {Object=} options Options.
   */
  initialize: function(latLngBounds, options) {
    Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
  },

  /**
   * Sets rectangle bounds.
   * @param {!LatLngBounds|LatLng[]} latLngBounds New bounds.
   * @return {!Rectangle} This rectangle.
   */
  setBounds: function(latLngBounds) {
    return this.setLatLngs(this._boundsToLatLngs(latLngBounds));
  },

  /**
   * Converts bounds to LatLng array.
   * @param {!LatLngBounds|LatLng[]} latLngBounds Input bounds.
   * @return {LatLng[]} Corner array.
   * @private
   */
  _boundsToLatLngs: function(latLngBounds) {
    latLngBounds = toLatLngBounds(latLngBounds);
    return [
      latLngBounds.getSouthWest(),
      latLngBounds.getNorthWest(),
      latLngBounds.getNorthEast(),
      latLngBounds.getSouthEast(),
    ];
  },
});

/**
 * Creates a rectangle.
 * @param {!LatLngBounds|LatLng[]} latLngBounds Bounds.
 * @param {Object=} options Options.
 * @return {!Rectangle} New rectangle.
 */
function rectangle(latLngBounds, options) {
  return new Rectangle(latLngBounds, options);
}

/**
 * Simplifies points using Douglas-Peucker algorithm.
 * @param {Point[]} points Input points.
 * @param {number} tolerance Simplification tolerance.
 * @return {Point[]} Simplified points.
 */
function simplify(points, tolerance) {
  if (!tolerance || !points.length) {
    return points.slice();
  }
  const sqTolerance = tolerance * tolerance;
  let simplifiedPoints = _reducePoints(points, sqTolerance);
  simplifiedPoints = _simplifyDP(simplifiedPoints, sqTolerance);
  return simplifiedPoints;
}

/**
 * Calculates distance from point to segment.
 * @param {!Point} p Point.
 * @param {!Point} p1 Segment start.
 * @param {!Point} p2 Segment end.
 * @return {number} Distance.
 */
function pointToSegmentDistance(p, p1, p2) {
  return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

/**
 * Finds closest point on segment.
 * @param {!Point} p Point.
 * * @param {!Point} p1 Segment start.
 * @param {!Point} p2 Segment end.
 * @return {!Point} Closest point.
 */
function closestPointOnSegment(p, p1, p2) {
  return _sqClosestPointOnSegment(p, p1, p2);
}

/**
 * Douglas-Peucker simplification implementation.
 * @param {Point[]} points Input points.
 * @param {number} sqTolerance Squared tolerance.
 * @return {Point[]} Simplified points.
 * @private
 */
function _simplifyDP(points, sqTolerance) {
  const len = points.length;
  const ArrayConstructor = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  const markers = new ArrayConstructor(len);
  markers[0] = markers[len - 1] = 1;

  _simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

  const newPoints = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) {
      newPoints.push(points[i]);
    }
  }
  return newPoints;
}

/**
 * Recursive Douglas-Peucker step.
 * @param {Point[]} points Input points.
 * @param {Array} markers Marker array.
 * @param {number} sqTolerance Squared tolerance.
 * @param {number} first Start index.
 * @param {number} last End index.
 * @private
 */
function _simplifyDPStep(points, markers, sqTolerance, first, last) {
  let maxSqDist = 0;
  let index;
  let sqDist;
  for (let i = first + 1; i <= last - 1; i++) {
    sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }
  if (maxSqDist > sqTolerance) {
    markers[index] = 1;
    _simplifyDPStep(points, markers, sqTolerance, first, index);
    _simplifyDPStep(points, markers, sqTolerance, index, last);
  }
}

/**
 * Reduces points by removing those too close together.
 * @param {Point[]} points Input points.
 * @param {number} sqTolerance Squared tolerance.
 * @return {Point[]} Reduced points.
 * @private
 */
function _reducePoints(points, sqTolerance) {
  const reducedPoints = [points[0]];
  for (let i = 1, prev = 0, len = points.length; i < len; i++) {
    if (_sqDist(points[i], points[prev]) > sqTolerance) {
      reducedPoints.push(points[i]);
      prev = i;
    }
  }
  if (prev < len - 1) {
    reducedPoints.push(points[len - 1]);
  }
  return reducedPoints;
}

/**
 * Clips a segment to bounds.
 * @param {!Point} a Start point.
 * @param {!Point} b End point.
 * @param {!Bounds} bounds Clipping bounds.
 * @param {boolean=} useLastCode Whether to use cached bit code.
 * @param {boolean=} round Whether to round result.
 * @return {Point[]|boolean} Clipped segment or false if rejected.
 */
function clipSegment(a, b, bounds, useLastCode, round) {
  let codeA = useLastCode ? _lastCode : _getBitCode(a, bounds);
  let codeB = _getBitCode(b, bounds);
  let codeOut;
  let p;
  let newCode;
  _lastCode = codeB;

  while (true) {
    if (!(codeA | codeB)) {
      return [a, b];
    }
    if (codeA & codeB) {
      return false;
    }
    codeOut = codeA || codeB;
    p = _getEdgeIntersection(a, b, codeOut, bounds, round);
    newCode = _getBitCode(p, bounds);
    if (codeOut === codeA) {
      a = p;
      codeA = newCode;
    } else {
      b = p;
      codeB = newCode;
    }
  }
}

/**
 * Gets intersection point with clipping edge.
 * @param {!Point} a Start point.
 * @param {!Point} b End point.
 * @param {number} code Edge code.
 * @param {!Bounds} bounds Clipping bounds.
 * @param {boolean=} round Whether to round.
 * @return {!Point} Intersection point.
 * @private
 */
function _getEdgeIntersection(a, b, code, bounds, round) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const min = bounds.min;
  const max = bounds.max;
  let x;
  let y;
  if (code & 8) {
    x = a.x + dx * (max.y - a.y) / dy;
    y = max.y;
  } else if (code & 4) {
    x = a.x + dx * (min.y - a.y) / dy;
    y = min.y;
  } else if (code & 2) {
    x = max.x;
    y = a.y + dy * (max.x - a.x) / dx;
  } else if (code & 1) {
    x = min.x;
    y = a.y + dy * (min.x - a.x) / dx;
  }
  return new Point(x, y, round);
}

/**
 * Gets bit code for Cohen-Sutherland clipping.
 * @param {!Point} p Point.
 * @param {!Bounds} bounds Clipping bounds.
 * @return {number} Bit code.
 * @private
 */
function _getBitCode(p, bounds) {
  let code = 0;
  if (p.x < bounds.min.x) {
    code |= 1;
  } else if (p.x > bounds.max.x) {
    code |= 2;
  }
  if (p.y < bounds.min.y) {
    code |= 4;
  } else if (p.y > bounds.max.y) {
    code |= 8;
  }
  return code;
}

/**
 * Calculates squared distance between points.
 * @param {!Point} p1 First point.
 * @param {!Point} p2 Second point.
 * @return {number} Squared distance.
 * @private
 */
function _sqDist(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Finds closest point on segment (squared distance version).
 * @param {!Point} p Point.
 * @param {!Point} p1 Segment start.
 * @param {!Point} p2 Segment end.
 * @param {boolean=} sqDist Whether to return squared distance.
 * @return {Point|number} Closest point or squared distance.
 * @private
 */
function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
  let x = p1.x;
  let y = p1.y;
  const dx = p2.x - x;
  const dy = p2.y - y;
  let dot = dx * dx + dy * dy;
  let t;
  if (dot > 0) {
    t = ((p.x - x) * dx + (p.y - y) * dy) / dot;
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p.x - x;
  dy = p.y - y;
  return sqDist ? dx * dx + dy * dy : new Point(x, y);
}

/**
 * Checks if LatLng array is flat (single ring).
 * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
 * @return {boolean} Whether flat.
 */
function isFlat(latlngs) {
  return !isArray(latlngs[0]) ||
      (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
}

/**
 * Deprecated flat check (for backward compatibility).
 * @param {LatLng[][]|LatLng[]} latlngs Coordinates.
 * @return {boolean} Whether flat.
 * @deprecated Use atlas.LineUtil.isFlat instead.
 */
function _flat(latlngs) {
  console.warn('Deprecated use of _flat, please use atlas.LineUtil.isFlat instead.');
  return isFlat(latlngs);
}

/**
 * Calculates polyline center point.
 * @param {LatLng[]} latlngs Coordinates.
 * @param {!Object} crs Coordinate reference system.
 * @return {!LatLng} Center.
 */
function polylineCenter(latlngs, crs) {
  if (!latlngs || latlngs.length === 0) {
    throw new Error('latlngs not passed');
  }
  if (!isFlat(latlngs)) {
    console.warn('latlngs are not flat! Only the first ring will be used');
    latlngs = latlngs[0];
  }
  const centroidLatLng = toLatLng([0, 0]);
  const bounds = toLatLngBounds(latlngs);
  const areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) *
      bounds.getNorthEast().distanceTo(bounds.getNorthWest());
  if (areaBounds < 1700) {
    centroidLatLng = centroid(latlngs);
  }
  const len = latlngs.length;
  const points = [];
  for (let i = 0; i < len; i++) {
    const latlng = toLatLng(latlngs[i]);
    points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
  }
  let halfDist = 0;
  for (let i = 0; i < len - 1; i++) {
    halfDist += points[i].distanceTo(points[i + 1]) / 2;
  }
  let center;
  if (halfDist === 0) {
    center = points[0];
  } else {
    let dist = 0;
    for (let i = 0; i < len - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segDist = p1.distanceTo(p2);
      dist += segDist;
      if (dist > halfDist) {
        const ratio = (dist - halfDist) / segDist;
        center = [
          p2.x - ratio * (p2.x - p1.x),
          p2.y - ratio * (p2.y - p1.y),
        ];
        break;
      }
    }
  }
  const latlngCenter = crs.unproject(toPoint(center));
  return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
}

/**
 * Line utilities.
 * @type {!Object}
 */
const LineUtil = {
  simplify: simplify,
  pointToSegmentDistance: pointToSegmentDistance,
  closestPointOnSegment: closestPointOnSegment,
  clipSegment: clipSegment,
  _getEdgeIntersection: _getEdgeIntersection,
  _getBitCode: _getBitCode,
  _sqClosestPointOnSegment: _sqClosestPointOnSegment,
  isFlat: isFlat,
  _flat: _flat,
  polylineCenter: polylineCenter,
};

/**
 * Clips polygon to bounds.
 * @param {Point[]} points Input points.
 * @param {!Bounds} bounds Clipping bounds.
 * @param {boolean=} round Whether to round.
 * @return {Point[]} Clipped points.
 */
function clipPolygon(points, bounds, round) {
  let clippedPoints;
  const edges = [1, 4, 2, 8];
  let i;
  let j;
  let k;
  let a;
  let b;
  let len;
  let edge;
  let p;

  for (i = 0, len = points.length; i < len; i++) {
    points[i]._code = _getBitCode(points[i], bounds);
  }

  for (k = 0; k < 4; k++) {
    edge = edges[k];
    clippedPoints = [];
    for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
      a = points[i];
      b = points[j];
      if (!(a._code & edge)) {
        if (b._code & edge) {
          p = _getEdgeIntersection(b, a, edge, bounds, round);
          p._code = _getBitCode(p, bounds);
          clippedPoints.push(p);
        }
        clippedPoints.push(a);
      } else if (!(b._code & edge)) {
        p = _getEdgeIntersection(b, a, edge, bounds, round);
        p._code = _getBitCode(p, bounds);
        clippedPoints.push(p);
      }
    }
    points = clippedPoints;
  }
  return points;
}

/**
 * Calculates polygon center point.
 * @param {LatLng[]} latlngs Coordinates.
 * @param {!Object} crs Coordinate reference system.
 * @return {!LatLng} Center.
 */
function polygonCenter(latlngs, crs) {
  if (!latlngs || latlngs.length === 0) {
    throw new Error('latlngs not passed');
  }
  if (!isFlat(latlngs)) {
    console.warn('latlngs are not flat! Only the first ring will be used');
    latlngs = latlngs[0];
  }
  const centroidLatLng = toLatLng([0, 0]);
  const bounds = toLatLngBounds(latlngs);
  const areaBounds = bounds.getNorthWest().distanceTo(bounds.getSouthWest()) *
      bounds.getNorthEast().distanceTo(bounds.getNorthWest());
  if (areaBounds < 1700) {
    centroidLatLng = centroid(latlngs);
  }
  const len = latlngs.length;
  const points = [];
  for (let i = 0; i < len; i++) {
    const latlng = toLatLng(latlngs[i]);
    points.push(crs.project(toLatLng([latlng.lat - centroidLatLng.lat, latlng.lng - centroidLatLng.lng])));
  }
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const p1 = points[i];
    const p2 = points[j];
    const f = p1.y * p2.x - p2.y * p1.x;
    x += (p1.x + p2.x) * f;
    y += (p1.y + p2.y) * f;
    area += f * 3;
  }
  let center;
  if (area === 0) {
    center = points[0];
  } else {
    center = [x / area, y / area];
  }
  const latlngCenter = crs.unproject(toPoint(center));
  return toLatLng([latlngCenter.lat + centroidLatLng.lat, latlngCenter.lng + centroidLatLng.lng]);
}

/**
 * Calculates centroid of points.
 * @param {LatLng[]} coords Coordinates.
 * @return {!LatLng} Centroid.
 */
function centroid(coords) {
  let latSum = 0;
  let lngSum = 0;
  let len = 0;
  for (let i = 0; i < coords.length; i++) {
    const latlng = toLatLng(coords[i]);
    latSum += latlng.lat;
    lngSum += latlng.lng;
    len++;
  }
  return toLatLng([latSum / len, lngSum / len]);
}

/**
 * Polygon utilities.
 * @type {!Object}
 */
const PolyUtil = {
  clipPolygon: clipPolygon,
  polygonCenter: polygonCenter,
  centroid: centroid,
};
