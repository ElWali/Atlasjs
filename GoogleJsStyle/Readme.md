## 📦 Project Structure

**Atlas.js** is organized into **16 modular sections**, each responsible for a distinct subsystem of the library. This modular architecture ensures clarity, maintainability, and scalability — allowing developers to understand, modify, or extend specific parts of the codebase without affecting others.

---

### **1. Core Utilities & Setup**

Provides the foundation for the entire library.
Includes the **UMD wrapper** for compatibility with different module systems, the **`Util`** module for essential helpers (`extend`, `bind`, `stamp`, `throttle`, etc.), as well as **browser detection** (`Browser`) and **DOM management utilities** (`DomUtil`, `DomEvent`).
This section establishes the core environment in which Atlas.js operates.

---

### **2. Class System & Events**

Implements Atlas.js’s lightweight object-oriented system.
The **`Class`** module enables inheritance and method extension, while the **`Evented`** base class introduces custom event handling.
The **`Mixin.Events`** utility allows classes to integrate event functionality without deep inheritance, promoting flexibility and modularity.

---

### **3. Geometric Primitives**

Defines the fundamental geometric types that form the basis of spatial computation.
Includes **`Point`**, **`Bounds`**, **`LatLng`**, and **`LatLngBounds`**, alongside coordinate conversion helpers such as `toPoint()` and `toLatLng()`.
These primitives provide the mathematical framework for positioning, measuring, and transforming map elements.

---

### **4. Projection & CRS**

Handles the mathematical transformations between geographic coordinates and projected map coordinates.
Contains **`Transformation`**, the **`CRS`** (Coordinate Reference System) base class, and standard systems like **`EPSG3857`**, **`Earth`**, and **`SphericalMercator`**.
This section ensures consistency between latitude/longitude data and the displayed map projection.

---

### **5. Map Core**

The heart of Atlas.js — defines the **`Map`** class that controls rendering, view state, and event flow.
Manages zoom, pan, bounds, and pixel conversions, while also handling user input, resize events, and scroll prevention.
All map interactions and visual updates are orchestrated from here.

---

### **6. Layers Base & Grouping**

Provides the abstraction for all visual content added to the map.
The **`Layer`** base class defines the interface for rendering and interaction, while **`LayerGroup`** and **`FeatureGroup`** manage collections of layers.
Includes mechanisms for adding, removing, and managing layers dynamically.

---

### **7. Vector Layers**

Implements all geometry-based visual features.
Includes **`Path`**, the base for vector rendering, as well as **`CircleMarker`**, **`Circle`**, **`Polyline`**, **`Polygon`**, and **`Rectangle`**.
Geometry utilities like **`LineUtil`** and **`PolyUtil`** support calculations such as clipping, simplification, and intersection detection.

---

### **8. Raster & Overlay Layers**

Responsible for rendering static or semi-dynamic overlays on top of the map.
Modules include **`ImageOverlay`**, **`VideoOverlay`**, **`SVGOverlay`**, and **`DivIcon`**.
These layers support integration of media and HTML elements seamlessly within the map viewport.

---

### **9. Tile Layers**

Manages tiled raster rendering — the backbone of modern web mapping.
Includes **`GridLayer`**, **`TileLayer`**, and **`TileLayer.WMS`** for dynamic loading, caching, wrapping, and error handling of map tiles from remote servers.
Optimized for smooth panning and zooming experiences on mobile devices.

---

### **10. Renderers**

Defines how vector layers are drawn to the screen.
The **`Renderer`** base class abstracts the rendering logic, while **`Canvas`** and **`SVG`** renderers implement two distinct drawing pipelines.
This section ensures efficient and accurate rendering across devices and browsers.

---

### **11. Markers & Icons**

Handles all point-based visual features.
Includes the **`Icon`** and **`Icon.Default`** classes for image-based markers, as well as **`DivIcon`** for HTML-based markers.
The **`Marker`** class provides positioning, interactivity, and optional dragging support via **`MarkerDrag`**.

---

### **12. Popups & Tooltips**

Implements user-facing overlays that provide contextual information.
The **`DivOverlay`** base class powers both **`Popup`** and **`Tooltip`**, allowing interactive content, auto-positioning, and event-triggered visibility.
These elements enhance map usability and data interactivity.

---

### **13. Controls**

Defines the interactive user interface elements positioned around the map.
Includes a **`Control`** base class and built-in controls for **zoom**, **scale**, **attribution**, and **layer switching**.
Controls are modular and can be easily customized or extended.

---

### **14. Map Interaction Handlers**

Manages all user input methods and gesture recognition.
The **`Handler`** base class supports various implementations like **`Drag`**, **`DoubleClickZoom`**, **`ScrollWheelZoom`**, **`BoxZoom`**, **`Keyboard`**, **`TouchZoom`**, and **`TapHold`**.
This section ensures responsive, smooth map interactions across devices.

---

### **15. GeoJSON Support**

Adds native support for **GeoJSON**, the standard data format for geographic features.
The **`GeoJSON`** layer parses and renders GeoJSON geometries, while providing **geometry-to-layer** conversion and **`toGeoJSON()`** export methods.
This makes Atlas.js interoperable with most GIS and web mapping workflows.

---

### **16. Public API Exports**

Defines the external API surface available to developers.
Includes factory functions such as **`map()`**, **`tileLayer()`**, **`marker()`**, **`circle()`**, **`polygon()`**, and **`geoJSON()`**, along with utility exports and version information.
This section serves as the main interface between the internal modules and user applications.

---
