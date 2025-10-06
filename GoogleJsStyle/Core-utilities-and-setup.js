/* Atlas.js is a lightweight JavaScript library for mobile-friendly interactive maps 🇲🇦 */
/*  © ElWali */
(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?
      factory(exports) :
      typeof define === 'function' && define.amd ?
      define(['exports'], factory) :
      (global = typeof globalThis !== 'undefined' ? globalThis :
           global || self, factory(global.atlas = {}));
})(this, (function(exports) {
'use strict';

const version = '0.0.1';

/**
 * Extends destination object with properties from source objects.
 * @param {!Object} dest Destination object.
 * @param {...Object} src Source objects.
 * @return {!Object} Extended destination object.
 */
function extend(dest) {
  for (let j = 1, len = arguments.length; j < len; j++) {
    const src = arguments[j];
    for (const i in src) {
      dest[i] = src[i];
    }
  }
  return dest;
}

const create$2 = Object.create || (function() {
  function F() {}
  return function(proto) {
    F.prototype = proto;
    return new F();
  };
})();

/**
 * Binds a function to a context.
 * @param {Function} fn Function to bind.
 * @param {Object} obj Context object.
 * @param {...*} args Additional arguments.
 * @return {Function} Bound function.
 */
function bind(fn, obj) {
  const slice = Array.prototype.slice;
  if (fn.bind) {
    return fn.bind.apply(fn, slice.call(arguments, 1));
  }
  const args = slice.call(arguments, 2);
  return function() {
    return fn.apply(obj, args.length ?
        args.concat(slice.call(arguments)) : arguments);
  };
}

let lastId = 0;

/**
 * Assigns a unique ID to an object if not present.
 * @param {!Object} obj Target object.
 * @return {number} Unique ID.
 */
function stamp(obj) {
  if (!('_atlas_id' in obj)) {
    obj['_atlas_id'] = ++lastId;
  }
  return obj._atlas_id;
}

/**
 * Throttles a function call.
 * @param {Function} fn Function to throttle.
 * @param {number} time Throttle delay in ms.
 * @param {Object=} context Execution context.
 * @return {Function} Throttled function.
 */
function throttle(fn, time, context) {
  let lock, args, wrapperFn, later;
  later = function() {
    lock = false;
    if (args) {
      wrapperFn.apply(context, args);
      args = false;
    }
  };
  wrapperFn = function() {
    if (lock) {
      args = arguments;
    } else {
      fn.apply(context, arguments);
      setTimeout(later, time);
      lock = true;
    }
  };
  return wrapperFn;
}

/**
 * Wraps a number within a range.
 * @param {number} x Value to wrap.
 * @param {Array<number>} range Range [min, max].
 * @param {boolean=} includeMax Whether to include max value.
 * @return {number} Wrapped value.
 */
function wrapNum(x, range, includeMax) {
  const max = range[1];
  const min = range[0];
  const d = max - min;
  return x === max && includeMax ? x :
      ((x - min) % d + d) % d + min;
}

/**
 * Returns false.
 * @return {boolean} Always false.
 */
function falseFn() {
  return false;
}

/**
 * Formats a number to specified precision.
 * @param {number} num Number to format.
 * @param {number|boolean=} precision Precision or false to skip rounding.
 * @return {number} Formatted number.
 */
function formatNum(num, precision) {
  if (precision === false) {
    return num;
  }
  const pow = Math.pow(10, precision === undefined ? 6 : precision);
  return Math.round(num * pow) / pow;
}

/**
 * Trims whitespace from a string.
 * @param {string} str Input string.
 * @return {string} Trimmed string.
 */
function trim(str) {
  return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

/**
 * Splits a string into words.
 * @param {string} str Input string.
 * @return {Array<string>} Array of words.
 */
function splitWords(str) {
  return trim(str).split(/\s+/);
}

/**
 * Sets options on an object.
 * @param {!Object} obj Target object.
 * @param {!Object} options Options to set.
 * @return {!Object} Merged options.
 */
function setOptions(obj, options) {
  if (!Object.prototype.hasOwnProperty.call(obj, 'options')) {
    obj.options = obj.options ? create$2(obj.options) : {};
  }
  for (const i in options) {
    obj.options[i] = options[i];
  }
  return obj.options;
}

/**
 * Converts an object to a URL query string.
 * @param {!Object} obj Parameters object.
 * @param {string=} existingUrl Base URL.
 * @param {boolean=} uppercase Whether to uppercase keys.
 * @return {string} Query string.
 */
function getParamString(obj, existingUrl, uppercase) {
  const params = [];
  for (const i in obj) {
    params.push(
        encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' +
        encodeURIComponent(obj[i]));
  }
  return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') +
      params.join('&');
}

const templateRe = /\{ *([\w_ -]+) *\}/g;

/**
 * Replaces placeholders in a template string.
 * @param {string} str Template string.
 * @param {!Object} data Replacement data.
 * @return {string} Rendered string.
 */
function template(str, data) {
  return str.replace(templateRe, function(str, key) {
    let value = data[key];
    if (value === undefined) {
      throw new Error('No value provided for variable ' + str);
    } else if (typeof value === 'function') {
      value = value(data);
    }
    return value;
  });
}

const isArray = Array.isArray || function(obj) {
  return (Object.prototype.toString.call(obj) === '[object Array]');
};

/**
 * Finds index of an element in an array.
 * @param {Array} array Array to search.
 * @param {*} el Element to find.
 * @return {number} Index or -1.
 */
function indexOf(array, el) {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === el) {
      return i;
    }
  }
  return -1;
}

const emptyImageUrl =
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

/**
 * Gets a prefixed browser API.
 * @param {string} name API name.
 * @return {*} Prefixed API or undefined.
 */
function getPrefixed(name) {
  return window['webkit' + name] || window['moz' + name] ||
      window['ms' + name];
}

let lastTime = 0;

/**
 * Defers a function using setTimeout with animation-frame-like timing.
 * @param {Function} fn Function to defer.
 * @return {number} Timeout ID.
 */
function timeoutDefer(fn) {
  const time = +new Date();
  const timeToCall = Math.max(0, 16 - (time - lastTime));
  lastTime = time + timeToCall;
  return window.setTimeout(fn, timeToCall);
}

const requestFn = window.requestAnimationFrame || getPrefixed(
    'RequestAnimationFrame') || timeoutDefer;
const cancelFn = window.cancelAnimationFrame ||
    getPrefixed('CancelAnimationFrame') ||
    getPrefixed('CancelRequestAnimationFrame') ||
    function(id) {
      window.clearTimeout(id);
    };

/**
 * Requests an animation frame.
 * @param {Function} fn Callback.
 * @param {Object=} context Context.
 * @param {boolean=} immediate Whether to call immediately if needed.
 * @return {number|undefined} Request ID or undefined.
 */
function requestAnimFrame(fn, context, immediate) {
  if (immediate && requestFn === timeoutDefer) {
    fn.call(context);
  } else {
    return requestFn.call(window, bind(fn, context));
  }
}

/**
 * Cancels an animation frame.
 * @param {number=} id Request ID.
 */
function cancelAnimFrame(id) {
  if (id) {
    cancelFn.call(window, id);
  }
}

const Util = {
  extend: extend,
  create: create$2,
  bind: bind,
  get lastId() {
    return lastId;
  },
  stamp: stamp,
  throttle: throttle,
  wrapNum: wrapNum,
  falseFn: falseFn,
  formatNum: formatNum,
  trim: trim,
  splitWords: splitWords,
  setOptions: setOptions,
  getParamString: getParamString,
  template: template,
  isArray: isArray,
  indexOf: indexOf,
  emptyImageUrl: emptyImageUrl,
  requestFn: requestFn,
  cancelFn: cancelFn,
  requestAnimFrame: requestAnimFrame,
  cancelAnimFrame: cancelAnimFrame,
};

/**
 * Checks for deprecated mixin usage.
 * @param {Array|Object} includes Mixin array or object.
 */
function checkDeprecatedMixinEvents(includes) {
  if (typeof L === 'undefined' || !L || !L.Mixin) {
    return;
  }
  includes = isArray(includes) ? includes : [includes];
  for (let i = 0; i < includes.length; i++) {
    if (includes[i] === atlas.Mixin.Events) {
      console.warn('Deprecated include of atlas.Mixin.Events: ' +
          'this property will be removed in future releases, ' +
          'please inherit from atlas.Evented instead.', new Error().stack);
    }
  }
}

// Browser detection
const style = document.documentElement.style;

const edge = 'msLaunchUri' in navigator && !('documentMode' in document);
const webkit = userAgentContains('webkit');
const android = userAgentContains('android');
const android23 = userAgentContains('android 2') || userAgentContains('android 3');
const webkitVer = parseInt(/WebKit\/([0-9]+)|$/.exec(navigator.userAgent)[1], 10);
const androidStock = android && userAgentContains('Google') && webkitVer < 537 &&
    !('AudioNode' in window);
const opera = !!window.opera;
const chrome = !edge && userAgentContains('chrome');
const gecko = userAgentContains('gecko') && !webkit && !opera;
const safari = !chrome && userAgentContains('safari');
const phantom = userAgentContains('phantom');
const opera12 = 'OTransition' in style;
const win = navigator.platform.indexOf('Win') === 0;
const webkit3d = ('WebKitCSSMatrix' in window) &&
    ('m11' in new window.WebKitCSSMatrix()) && !android23;
const gecko3d = 'MozPerspective' in style;
const any3d = !window.ATLAS_DISABLE_3D && (webkit3d || gecko3d) && !opera12 && !phantom;
const mobile = typeof orientation !== 'undefined' || userAgentContains('mobile');
const mobileWebkit = mobile && webkit;
const mobileWebkit3d = mobile && webkit3d;
const msPointer = !window.PointerEvent && window.MSPointerEvent;
const pointer = !!(window.PointerEvent || msPointer);
const touchNative = 'ontouchstart' in window || !!window.TouchEvent;
const touch = !window.ATLAS_NO_TOUCH && (touchNative || pointer);
const mobileOpera = mobile && opera;
const mobileGecko = mobile && gecko;
const retina = (window.devicePixelRatio ||
    (window.screen.deviceXDPI / window.screen.logicalXDPI)) > 1;

/**
 * Tests if passive event listeners are supported.
 * @return {boolean} Whether passive events are supported.
 */
function testPassiveEvents() {
  let supportsPassiveOption = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassiveOption = true;
      },
    });
    window.addEventListener('testPassiveEventSupport', falseFn, opts);
    window.removeEventListener('testPassiveEventSupport', falseFn, opts);
  } catch (e) {
    // Ignore
  }
  return supportsPassiveOption;
}

const passiveEvents = testPassiveEvents();

const canvas$1 = (function() {
  return !!document.createElement('canvas').getContext;
})();

const svg$1 = !!(document.createElementNS && createSvg('svg')).createSVGRect;

/**
 * Creates an SVG element.
 * @param {string} name Element name.
 * @return {!Element} SVG element.
 */
function createSvg(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

const inlineSvg = !!svg$1 && (function() {
  const div = document.createElement('div');
  div.innerHTML = '<svg/>';
  return (div.firstChild && div.firstChild.namespaceURI) ===
      'http://www.w3.org/2000/svg';
})();

const mac = navigator.platform.indexOf('Mac') === 0;
const linux = navigator.platform.indexOf('Linux') === 0;

/**
 * Checks if user agent contains a string.
 * @param {string} str String to search.
 * @return {boolean} Whether found.
 */
function userAgentContains(str) {
  return navigator.userAgent.toLowerCase().indexOf(str) >= 0;
}

const Browser = {
  edge: edge,
  webkit: webkit,
  android: android,
  android23: android23,
  androidStock: androidStock,
  opera: opera,
  chrome: chrome,
  gecko: gecko,
  safari: safari,
  phantom: phantom,
  opera12: opera12,
  win: win,
  webkit3d: webkit3d,
  gecko3d: gecko3d,
  any3d: any3d,
  mobile: mobile,
  mobileWebkit: mobileWebkit,
  mobileWebkit3d: mobileWebkit3d,
  msPointer: msPointer,
  pointer: pointer,
  touch: touch,
  touchNative: touchNative,
  mobileOpera: mobileOpera,
  mobileGecko: mobileGecko,
  retina: retina,
  passiveEvents: passiveEvents,
  canvas: canvas$1,
  svg: svg$1,
  inlineSvg: inlineSvg,
  mac: mac,
  linux: linux,
};

// DOM Utilities
const TRANSFORM = testProp(
    ['transform', 'webkitTransform', 'OTransform', 'MozTransform', 'msTransform']);
const TRANSITION = testProp(
    ['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);
const TRANSITION_END =
    TRANSITION === 'webkitTransition' || TRANSITION === 'OTransition' ?
    TRANSITION + 'End' : 'transitionend';

/**
 * Gets an element by ID or returns the element itself.
 * @param {string|Element} id Element ID or element.
 * @return {Element} Element.
 */
function get(id) {
  return typeof id === 'string' ? document.getElementById(id) : id;
}

/**
 * Gets computed style of an element.
 * @param {!Element} el Element.
 * @param {string} style Style property.
 * @return {string} Computed style value.
 */
function getStyle(el, style) {
  let value = el.style[style] || (el.currentStyle && el.currentStyle[style]);
  if ((!value || value === 'auto') && document.defaultView) {
    const css = document.defaultView.getComputedStyle(el, null);
    value = css ? css[style] : null;
  }
  return value === 'auto' ? null : value;
}

/**
 * Creates a DOM element.
 * @param {string} tagName Tag name.
 * @param {string=} className Class name.
 * @param {Element=} container Parent container.
 * @return {!Element} Created element.
 */
function create$1(tagName, className, container) {
  const el = document.createElement(tagName);
  el.className = className || '';
  if (container) {
    container.appendChild(el);
  }
  return el;
}

/**
 * Removes an element from DOM.
 * @param {!Element} el Element to remove.
 */
function remove(el) {
  const parent = el.parentNode;
  if (parent) {
    parent.removeChild(el);
  }
}

/**
 * Empties an element's children.
 * @param {!Element} el Element to empty.
 */
function empty(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Moves element to front.
 * @param {!Element} el Element.
 */
function toFront(el) {
  const parent = el.parentNode;
  if (parent && parent.lastChild !== el) {
    parent.appendChild(el);
  }
}

/**
 * Moves element to back.
 * @param {!Element} el Element.
 */
function toBack(el) {
  const parent = el.parentNode;
  if (parent && parent.firstChild !== el) {
    parent.insertBefore(el, parent.firstChild);
  }
}

/**
 * Checks if element has a class.
 * @param {!Element} el Element.
 * @param {string} name Class name.
 * @return {boolean} Whether has class.
 */
function hasClass(el, name) {
  if (el.classList !== undefined) {
    return el.classList.contains(name);
  }
  const className = getClass(el);
  return className.length > 0 &&
      new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
}

/**
 * Adds class to element.
 * @param {!Element} el Element.
 * @param {string} name Class name.
 */
function addClass(el, name) {
  if (el.classList !== undefined) {
    const classes = splitWords(name);
    for (let i = 0, len = classes.length; i < len; i++) {
      el.classList.add(classes[i]);
    }
  } else if (!hasClass(el, name)) {
    const className = getClass(el);
    setClass(el, (className ? className + ' ' : '') + name);
  }
}

/**
 * Removes class from element.
 * @param {!Element} el Element.
 * @param {string} name Class name.
 */
function removeClass(el, name) {
  if (el.classList !== undefined) {
    el.classList.remove(name);
  } else {
    setClass(el, trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
  }
}

/**
 * Sets element's class attribute.
 * @param {!Element} el Element.
 * @param {string} name Class name.
 */
function setClass(el, name) {
  if (el.className.baseVal === undefined) {
    el.className = name;
  } else {
    el.className.baseVal = name;
  }
}

/**
 * Gets element's class attribute.
 * @param {!Element} el Element.
 * @return {string} Class name.
 */
function getClass(el) {
  if (el.correspondingElement) {
    el = el.correspondingElement;
  }
  return el.className.baseVal === undefined ? el.className : el.className.baseVal;
}

/**
 * Sets element opacity.
 * @param {!Element} el Element.
 * @param {number} value Opacity value (0–1).
 */
function setOpacity(el, value) {
  if ('opacity' in el.style) {
    el.style.opacity = value;
  } else if ('filter' in el.style) {
    _setOpacityIE(el, value);
  }
}

/**
 * Sets opacity for IE.
 * @param {!Element} el Element.
 * @param {number} value Opacity.
 * @private
 */
function _setOpacityIE(el, value) {
  let filter = false;
  const filterName = 'DXImageTransform.Microsoft.Alpha';
  try {
    filter = el.filters.item(filterName);
  } catch (e) {
    if (value === 1) {
      return;
    }
  }
  value = Math.round(value * 100);
  if (filter) {
    filter.Enabled = (value !== 100);
    filter.Opacity = value;
  } else {
    el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
  }
}

/**
 * Tests for CSS property support.
 * @param {Array<string>} props Property names.
 * @return {string|boolean} Supported property or false.
 */
function testProp(props) {
  const style = document.documentElement.style;
  for (let i = 0; i < props.length; i++) {
    if (props[i] in style) {
      return props[i];
    }
  }
  return false;
}

/**
 * Sets CSS transform on element.
 * @param {!Element} el Element.
 * @param {Point=} offset Translation offset.
 * @param {number=} scale Scale factor.
 */
function setTransform(el, offset, scale) {
  const pos = offset || new Point(0, 0);
  el.style[TRANSFORM] =
      'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)' +
      (scale ? ' scale(' + scale + ')' : '');
}

/**
 * Sets element position.
 * @param {!Element} el Element.
 * @param {Point} point Position.
 */
function setPosition(el, point) {
  el._atlas_pos = point;
  if (Browser.any3d) {
    setTransform(el, point);
  } else {
    el.style.left = point.x + 'px';
    el.style.top = point.y + 'px';
  }
}

/**
 * Gets element position.
 * @param {!Element} el Element.
 * @return {Point} Position.
 */
function getPosition(el) {
  return el._atlas_pos || new Point(0, 0);
}

let _userSelect;

/**
 * Disables text selection.
 */
function disableTextSelection() {
  if ('onselectstart' in document) {
    on(window, 'selectstart', preventDefault);
  } else {
    const userSelectProperty = testProp(
        ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect',
         'msUserSelect']);
    if (userSelectProperty) {
      const style = document.documentElement.style;
      _userSelect = style[userSelectProperty];
      style[userSelectProperty] = 'none';
    }
  }
}

/**
 * Enables text selection.
 */
function enableTextSelection() {
  if ('onselectstart' in document) {
    off(window, 'selectstart', preventDefault);
  } else {
    if (_userSelect !== undefined) {
      document.documentElement.style[userSelectProperty] = _userSelect;
      _userSelect = undefined;
    }
  }
}

/**
 * Disables image dragging.
 */
function disableImageDrag() {
  on(window, 'dragstart', preventDefault);
}

/**
 * Enables image dragging.
 */
function enableImageDrag() {
  off(window, 'dragstart', preventDefault);
}

let _outlineElement;
let _outlineStyle;

/**
 * Prevents focus outline.
 * @param {!Element} element Element.
 */
function preventOutline(element) {
  while (element.tabIndex === -1) {
    element = element.parentNode;
  }
  if (!element.style) {
    return;
  }
  restoreOutline();
  _outlineElement = element;
  _outlineStyle = element.style.outlineStyle;
  element.style.outlineStyle = 'none';
  on(window, 'keydown', restoreOutline);
}

/**
 * Restores focus outline.
 */
function restoreOutline() {
  if (!_outlineElement) {
    return;
  }
  _outlineElement.style.outlineStyle = _outlineStyle;
  _outlineElement = undefined;
  _outlineStyle = undefined;
  off(window, 'keydown', restoreOutline);
}

/**
 * Gets nearest sized parent node.
 * @param {!Element} element Element.
 * @return {!Element} Sized parent.
 */
function getSizedParentNode(element) {
  do {
    element = element.parentNode;
  } while ((!element.offsetWidth || !element.offsetHeight) &&
           element !== document.body);
  return element;
}

/**
 * Gets element scale relative to CSS transform.
 * @param {!Element} element Element.
 * @return {{x: number, y: number, boundingClientRect: DOMRect}} Scale info.
 */
function getScale(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.width / element.offsetWidth || 1,
    y: rect.height / element.offsetHeight || 1,
    boundingClientRect: rect,
  };
}

const DomUtil = {
  TRANSFORM: TRANSFORM,
  TRANSITION: TRANSITION,
  TRANSITION_END: TRANSITION_END,
  get: get,
  getStyle: getStyle,
  create: create$1,
  remove: remove,
  empty: empty,
  toFront: toFront,
  toBack: toBack,
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  setClass: setClass,
  getClass: getClass,
  setOpacity: setOpacity,
  testProp: testProp,
  setTransform: setTransform,
  setPosition: setPosition,
  getPosition: getPosition,
  disableTextSelection: disableTextSelection,
  enableTextSelection: enableTextSelection,
  disableImageDrag: disableImageDrag,
  enableImageDrag: enableImageDrag,
  preventOutline: preventOutline,
  restoreOutline: restoreOutline,
  getSizedParentNode: getSizedParentNode,
  getScale: getScale,
};

// DOM Events
const eventsKey = '_atlas_events';

const mouseSubst = {
  mouseenter: 'mouseover',
  mouseleave: 'mouseout',
  wheel: !('onwheel' in window) && 'mousewheel',
};

/**
 * Adds event listener(s).
 * @param {!Object} obj Target object.
 * @param {string|Object} types Event type(s) or map.
 * @param {Function=} fn Handler function.
 * @param {Object=} context Execution context.
 * @return {!Object} Target object.
 */
function on(obj, types, fn, context) {
  if (types && typeof types === 'object') {
    for (const type in types) {
      addOne(obj, type, types[type], fn);
    }
  } else {
    types = splitWords(types);
    for (let i = 0, len = types.length; i < len; i++) {
      addOne(obj, types[i], fn, context);
    }
  }
  return this;
}

/**
 * Removes event listener(s).
 * @param {!Object} obj Target object.
 * @param {string|Object=} types Event type(s) or map.
 * @param {Function=} fn Handler function.
 * @param {Object=} context Execution context.
 * @return {!Object} Target object.
 */
function off(obj, types, fn, context) {
  if (arguments.length === 1) {
    batchRemove(obj);
    delete obj[eventsKey];
  } else if (types && typeof types === 'object') {
    for (const type in types) {
      removeOne(obj, type, types[type], fn);
    }
  } else {
    types = splitWords(types);
    if (arguments.length === 2) {
      batchRemove(obj, function(type) {
        return indexOf(types, type) !== -1;
      });
    } else {
      for (let i = 0, len = types.length; i < len; i++) {
        removeOne(obj, types[i], fn, context);
      }
    }
  }
  return this;
}

/**
 * Removes multiple listeners by filter.
 * @param {!Object} obj Target object.
 * @param {Function=} filterFn Filter function.
 * @private
 */
function batchRemove(obj, filterFn) {
  for (const id in obj[eventsKey]) {
    const type = id.split(/\d/)[0];
    if (!filterFn || filterFn(type)) {
      removeOne(obj, type, null, null, id);
    }
  }
}

/**
 * Adds a single event listener.
 * @param {!Object} obj Target object.
 * @param {string} type Event type.
 * @param {Function} fn Handler.
 * @param {Object=} context Context.
 * @private
 */
function addOne(obj, type, fn, context) {
  const id = type + stamp(fn) + (context ? '_' + stamp(context) : '');
  if (obj[eventsKey] && obj[eventsKey][id]) {
    return this;
  }
  let handler = function(e) {
    return fn.call(context || obj, e || window.event);
  };
  const originalHandler = handler;
  if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
    handler = addPointerListener(obj, type, handler);
  } else if (Browser.touch && (type === 'dblclick')) {
    handler = addDoubleTapListener(obj, handler);
  } else if ('addEventListener' in obj) {
    if (type === 'touchstart' || type === 'touchmove' || type === 'wheel' ||
        type === 'mousewheel') {
      obj.addEventListener(mouseSubst[type] || type, handler,
          Browser.passiveEvents ? {passive: false} : false);
    } else if (type === 'mouseenter' || type === 'mouseleave') {
      handler = function(e) {
        e = e || window.event;
        if (isExternalTarget(obj, e)) {
          originalHandler(e);
        }
      };
      obj.addEventListener(mouseSubst[type], handler, false);
    } else {
      obj.addEventListener(type, originalHandler, false);
    }
  } else {
    obj.attachEvent('on' + type, handler);
  }
  obj[eventsKey] = obj[eventsKey] || {};
  obj[eventsKey][id] = handler;
}

/**
 * Removes a single event listener.
 * @param {!Object} obj Target object.
 * @param {string} type Event type.
 * @param {Function} fn Handler.
 * @param {Object=} context Context.
 * @param {string=} id Listener ID.
 * @private
 */
function removeOne(obj, type, fn, context, id) {
  id = id || type + stamp(fn) + (context ? '_' + stamp(context) : '');
  const handler = obj[eventsKey] && obj[eventsKey][id];
  if (!handler) {
    return this;
  }
  if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
    removePointerListener(obj, type, handler);
  } else if (Browser.touch && (type === 'dblclick')) {
    removeDoubleTapListener(obj, handler);
  } else if ('removeEventListener' in obj) {
    obj.removeEventListener(mouseSubst[type] || type, handler, false);
  } else {
    obj.detachEvent('on' + type, handler);
  }
  obj[eventsKey][id] = null;
}

/**
 * Stops event propagation.
 * @param {Event} e Event.
 * @return {!Object} This.
 */
function stopPropagation(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  } else if (e.originalEvent) {
    e.originalEvent._stopped = true;
  } else {
    e.cancelBubble = true;
  }
  return this;
}

/**
 * Disables scroll propagation.
 * @param {!Element} el Element.
 * @return {!Object} This.
 */
function disableScrollPropagation(el) {
  addOne(el, 'wheel', stopPropagation);
  return this;
}

/**
 * Disables click propagation.
 * @param {!Element} el Element.
 * @return {!Object} This.
 */
function disableClickPropagation(el) {
  on(el, 'mousedown touchstart dblclick contextmenu', stopPropagation);
  el['_atlas_disable_click'] = true;
  return this;
}

/**
 * Prevents default event behavior.
 * @param {Event} e Event.
 * @return {!Object} This.
 */
function preventDefault(e) {
  if (e.preventDefault) {
    e.preventDefault();
  } else {
    e.returnValue = false;
  }
  return this;
}

/**
 * Stops event propagation and prevents default.
 * @param {Event} e Event.
 * @return {!Object} This.
 */
function stop(e) {
  preventDefault(e);
  stopPropagation(e);
  return this;
}

/**
 * Gets event propagation path.
 * @param {Event} ev Event.
 * @return {Array} Path.
 */
function getPropagationPath(ev) {
  if (ev.composedPath) {
    return ev.composedPath();
  }
  const path = [];
  let el = ev.target;
  while (el) {
    path.push(el);
    el = el.parentNode;
  }
  return path;
}

/**
 * Gets mouse position relative to container.
 * @param {Event} e Event.
 * @param {Element=} container Container.
 * @return {Point} Mouse position.
 */
function getMousePosition(e, container) {
  if (!container) {
    return new Point(e.clientX, e.clientY);
  }
  const scale = getScale(container);
  const offset = scale.boundingClientRect;
  return new Point(
      (e.clientX - offset.left) / scale.x - container.clientLeft,
      (e.clientY - offset.top) / scale.y - container.clientTop);
}

const wheelPxFactor =
    (Browser.linux && Browser.chrome) ? window.devicePixelRatio :
    Browser.mac ? window.devicePixelRatio * 3 :
    window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;

/**
 * Gets normalized wheel delta.
 * @param {Event} e Wheel event.
 * @return {number} Delta.
 */
function getWheelDelta(e) {
  return (Browser.edge) ? e.wheelDeltaY / 2 :
      (e.deltaY && e.deltaMode === 0) ? -e.deltaY / wheelPxFactor :
      (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 :
      (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 :
      (e.deltaX || e.deltaZ) ? 0 :
      e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 :
      (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 :
      e.detail ? e.detail / -32765 * 60 :
      0;
}

/**
 * Checks if event target is external.
 * @param {!Element} el Element.
 * @param {Event} e Event.
 * @return {boolean} Whether external.
 */
function isExternalTarget(el, e) {
  const related = e.relatedTarget;
  if (!related) {
    return true;
  }
  try {
    while (related && (related !== el)) {
      related = related.parentNode;
    }
  } catch (err) {
    return false;
  }
  return (related !== el);
}

const DomEvent = {
  on: on,
  off: off,
  stopPropagation: stopPropagation,
  disableScrollPropagation: disableScrollPropagation,
  disableClickPropagation: disableClickPropagation,
  preventDefault: preventDefault,
  stop: stop,
  getPropagationPath: getPropagationPath,
  getMousePosition: getMousePosition,
  getWheelDelta: getWheelDelta,
  isExternalTarget: isExternalTarget,
  addListener: on,
  removeListener: off,
};
