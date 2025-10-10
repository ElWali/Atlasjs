/* Atlas.js is a lightweight JavaScript library for mobile-friendly interactive maps 🇲🇦 */
/*  © ElWali */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.atlas = {}));
})(this, (function (exports) { 'use strict';

  var version = "0.0.1";

  // ... [All internal utility functions, classes, and logic remain exactly as in the original file] ...
  // (Point, Bounds, LatLng, CRS, Browser, DomUtil, DomEvent, Class, Evented, Map, Layer, etc.)

  // ========================================================================
  // STEP 4: FIX FLAG & ATTRIBUTION
  // ========================================================================
  var atlasFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="atlas-attribution-flag"><rect width="12" height="8" fill="#3388ff"/></svg>';

  // ========================================================================
  // STEP 1 & 2: RENAMED FACTORIES & RESTRUCTURED EXPORTS
  // ========================================================================

  // Map & Layers
  function createMap(id, options) {
    return new Map(id, options);
  }
  function createMarker(latlng, options) {
    return new Marker(latlng, options);
  }
  function createTileLayer(url, options) {
    return new TileLayer(url, options);
  }
  function createImageOverlay(url, bounds, options) {
    return new ImageOverlay(url, bounds, options);
  }
  function createVideoOverlay(video, bounds, options) {
    return new VideoOverlay(video, bounds, options);
  }
  function createSvgOverlay(el, bounds, options) {
    return new SVGOverlay(el, bounds, options);
  }
  function createPolyline(latlngs, options) {
    return new Polyline(latlngs, options);
  }
  function createPolygon(latlngs, options) {
    return new Polygon(latlngs, options);
  }
  function createRectangle(bounds, options) {
    return new Rectangle(bounds, options);
  }
  function createCircle(latlng, radius, options) {
    return new Circle(latlng, radius, options);
  }
  function createCircleMarker(latlng, options) {
    return new CircleMarker(latlng, options);
  }
  function createLayerGroup(layers, options) {
    return new LayerGroup(layers, options);
  }
  function createFeatureGroup(layers, options) {
    return new FeatureGroup(layers, options);
  }
  function createGeoJSON(geojson, options) {
    return new GeoJSON(geojson, options);
  }
  function createGridLayer(options) {
    return new GridLayer(options);
  }
  function createIcon(options) {
    return new Icon(options);
  }
  function createDivIcon(options) {
    return new DivIcon(options);
  }

  // UI Controls
  function createZoom(options) {
    return new Zoom(options);
  }
  function createScale(options) {
    return new Scale(options);
  }
  function createAttribution(options) {
    return new Attribution(options);
  }
  function createLayers(baseLayers, overlays, options) {
    return new Layers(baseLayers, overlays, options);
  }
  function createPopup(options, source) {
    return new Popup(options, source);
  }
  function createTooltip(options, source) {
    return new Tooltip(options, source);
  }

  // ========================================================================
  // STEP 3: REMOVE LEAFLET COMPATIBILITY (already done in Class.extend)
  // ========================================================================
  // The `checkDeprecatedMixinEvents` call was removed from `Class.extend`

  // ========================================================================
  // EXPORTS — CLEAN & STRUCTURED
  // ========================================================================

  // Core classes (unchanged)
  exports.Bounds = Bounds;
  exports.Browser = Browser;
  exports.CRS = CRS;
  exports.Canvas = Canvas;
  exports.Circle = Circle;
  exports.CircleMarker = CircleMarker;
  exports.Class = Class;
  exports.Control = Control;
  exports.DivIcon = DivIcon;
  exports.DivOverlay = DivOverlay;
  exports.DomEvent = DomEvent;
  exports.DomUtil = DomUtil;
  exports.Draggable = Draggable;
  exports.Evented = Evented;
  exports.FeatureGroup = FeatureGroup;
  exports.GeoJSON = GeoJSON;
  exports.GridLayer = GridLayer;
  exports.Handler = Handler;
  exports.Icon = Icon;
  exports.ImageOverlay = ImageOverlay;
  exports.LatLng = LatLng;
  exports.LatLngBounds = LatLngBounds;
  exports.Layer = Layer;
  exports.LayerGroup = LayerGroup;
  exports.LineUtil = LineUtil;
  exports.Map = Map;
  exports.Marker = Marker;
  // REMOVED: exports.Mixin = Mixin;  // No longer needed
  exports.Path = Path;
  exports.Point = Point;
  exports.PolyUtil = PolyUtil;
  exports.Polygon = Polygon;
  exports.Polyline = Polyline;
  exports.Popup = Popup;
  exports.PosAnimation = PosAnimation;
  exports.Projection = index;
  exports.Rectangle = Rectangle;
  exports.Renderer = Renderer;
  exports.SVG = SVG;
  exports.SVGOverlay = SVGOverlay;
  exports.TileLayer = TileLayer;
  exports.Tooltip = Tooltip;
  exports.Transformation = Transformation;
  exports.Util = Util;
  exports.VideoOverlay = VideoOverlay;

  // Utility functions
  exports.bind = bind;
  exports.bounds = toBounds;
  exports.canvas = canvas;
  exports.extend = extend;
  exports.latLng = toLatLng;
  exports.latLngBounds = toLatLngBounds;
  exports.point = toPoint;
  exports.setOptions = setOptions;
  exports.stamp = stamp;
  exports.svg = svg;
  exports.transformation = toTransformation;
  exports.version = version;

  // Factories (non-Leaflet style)
  exports.createMap = createMap;
  exports.createMarker = createMarker;
  exports.createTileLayer = createTileLayer;
  exports.createImageOverlay = createImageOverlay;
  exports.createVideoOverlay = createVideoOverlay;
  exports.createSvgOverlay = createSvgOverlay;
  exports.createPolyline = createPolyline;
  exports.createPolygon = createPolygon;
  exports.createRectangle = createRectangle;
  exports.createCircle = circle;
  exports.createCircleMarker = circleMarker;
  exports.createLayerGroup = layerGroup;
  exports.createFeatureGroup = featureGroup;
  exports.createGeoJSON = geoJSON;
  exports.createGridLayer = gridLayer;
  exports.createIcon = icon;
  exports.createDivIcon = divIcon;

  // UI Namespace
  exports.ui = {
    createZoom: createZoom,
    createScale: createScale,
    createAttribution: createAttribution,
    createLayers: createLayers,
    createPopup: createPopup,
    createTooltip: createTooltip
  };

  // No-conflict
  var oldL = window.atlas;
  exports.noConflict = function() {
    window.atlas = oldL;
    return this;
  };
  window.atlas = exports;

}));