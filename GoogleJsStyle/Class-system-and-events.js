/**
 * Base class for inheritance.
 * @constructor
 */
function Class() {}

/**
 * Extends the class with new properties.
 * @param {!Object} props Properties to extend with.
 * @return {Function} New extended class.
 */
Class.extend = function(props) {
  /**
   * @constructor
   */
  const NewClass = function() {
    setOptions(this);
    if (this.initialize) {
      this.initialize.apply(this, arguments);
    }
    this.callInitHooks();
  };

  const parentProto = NewClass.__super__ = this.prototype;
  const proto = create$2(parentProto);
  proto.constructor = NewClass;
  NewClass.prototype = proto;

  for (const i in this) {
    if (Object.prototype.hasOwnProperty.call(this, i) &&
        i !== 'prototype' && i !== '__super__') {
      NewClass[i] = this[i];
    }
  }

  if (props.statics) {
    extend(NewClass, props.statics);
  }

  if (props.includes) {
    checkDeprecatedMixinEvents(props.includes);
    extend.apply(null, [proto].concat(props.includes));
  }

  extend(proto, props);
  delete proto.statics;
  delete proto.includes;

  if (proto.options) {
    proto.options = parentProto.options ?
        create$2(parentProto.options) : {};
    extend(proto.options, props.options);
  }

  proto._initHooks = [];
  proto.callInitHooks = function() {
    if (this._initHooksCalled) {
      return;
    }
    if (parentProto.callInitHooks) {
      parentProto.callInitHooks.call(this);
    }
    this._initHooksCalled = true;
    for (let i = 0, len = proto._initHooks.length; i < len; i++) {
      proto._initHooks[i].call(this);
    }
  };

  return NewClass;
};

/**
 * Includes properties into the class prototype.
 * @param {!Object} props Properties to include.
 * @return {Function} This class.
 */
Class.include = function(props) {
  const parentOptions = this.prototype.options;
  extend(this.prototype, props);
  if (props.options) {
    this.prototype.options = parentOptions;
    this.mergeOptions(props.options);
  }
  return this;
};

/**
 * Merges options into the class prototype.
 * @param {!Object} options Options to merge.
 * @return {Function} This class.
 */
Class.mergeOptions = function(options) {
  extend(this.prototype.options, options);
  return this;
};

/**
 * Adds an initialization hook.
 * @param {Function|string} fn Function or method name.
 * @param {...*} args Arguments for the method (if string).
 * @return {Function} This class.
 */
Class.addInitHook = function(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  const init = typeof fn === 'function' ? fn : function() {
    this[fn].apply(this, args);
  };
  this.prototype._initHooks = this.prototype._initHooks || [];
  this.prototype._initHooks.push(init);
  return this;
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

/**
 * Event system mixin.
 * @type {!Object}
 */
const Events = {
  /**
   * Adds event listener(s).
   * @param {string|Object} types Event type(s) or map.
   * @param {Function=} fn Handler function.
   * @param {Object=} context Execution context.
   * @return {!Object} This.
   */
  on: function(types, fn, context) {
    if (typeof types === 'object') {
      for (const type in types) {
        this._on(type, types[type], fn);
      }
    } else {
      types = splitWords(types);
      for (let i = 0, len = types.length; i < len; i++) {
        this._on(types[i], fn, context);
      }
    }
    return this;
  },

  /**
   * Removes event listener(s).
   * @param {string|Object=} types Event type(s) or map.
   * @param {Function=} fn Handler function.
   * @param {Object=} context Execution context.
   * @return {!Object} This.
   */
  off: function(types, fn, context) {
    if (!arguments.length) {
      delete this._events;
    } else if (typeof types === 'object') {
      for (const type in types) {
        this._off(type, types[type], fn);
      }
    } else {
      types = splitWords(types);
      const removeAll = arguments.length === 1;
      for (let i = 0, len = types.length; i < len; i++) {
        if (removeAll) {
          this._off(types[i]);
        } else {
          this._off(types[i], fn, context);
        }
      }
    }
    return this;
  },

  /**
   * Internal method to add a listener.
   * @param {string} type Event type.
   * @param {Function} fn Handler.
   * @param {Object=} context Context.
   * @param {boolean=} _once Whether to fire once.
   * @private
   */
  _on: function(type, fn, context, _once) {
    if (typeof fn !== 'function') {
      console.warn('wrong listener type: ' + typeof fn);
      return;
    }
    if (this._listens(type, fn, context) !== false) {
      return;
    }
    if (context === this) {
      context = undefined;
    }
    const newListener = {fn: fn, ctx: context};
    if (_once) {
      newListener.once = true;
    }
    this._events = this._events || {};
    this._events[type] = this._events[type] || [];
    this._events[type].push(newListener);
  },

  /**
   * Internal method to remove a listener.
   * @param {string} type Event type.
   * @param {Function=} fn Handler.
   * @param {Object=} context Context.
   * @private
   */
  _off: function(type, fn, context) {
    let listeners;
    if (!this._events) {
      return;
    }
    listeners = this._events[type];
    if (!listeners) {
      return;
    }
    if (arguments.length === 1) {
      if (this._firingCount) {
        for (let i = 0, len = listeners.length; i < len; i++) {
          listeners[i].fn = falseFn;
        }
      }
      delete this._events[type];
      return;
    }
    if (typeof fn !== 'function') {
      console.warn('wrong listener type: ' + typeof fn);
      return;
    }
    const index = this._listens(type, fn, context);
    if (index !== false) {
      const listener = listeners[index];
      if (this._firingCount) {
        listener.fn = falseFn;
        this._events[type] = listeners = listeners.slice();
      }
      listeners.splice(index, 1);
    }
  },

  /**
   * Fires an event.
   * @param {string} type Event type.
   * @param {Object=} data Event data.
   * @param {boolean=} propagate Whether to propagate.
   * @return {!Object} This.
   */
  fire: function(type, data, propagate) {
    if (!this.listens(type, propagate)) {
      return this;
    }
    const event = extend({}, data, {
      type: type,
      target: this,
      sourceTarget: data && data.sourceTarget || this,
    });
    if (this._events) {
      const listeners = this._events[type];
      if (listeners) {
        this._firingCount = (this._firingCount + 1) || 1;
        for (let i = 0, len = listeners.length; i < len; i++) {
          const l = listeners[i];
          const fn = l.fn;
          if (l.once) {
            this.off(type, fn, l.ctx);
          }
          fn.call(l.ctx || this, event);
        }
        this._firingCount--;
      }
    }
    if (propagate) {
      this._propagateEvent(event);
    }
    return this;
  },

  /**
   * Checks if the object listens to an event.
   * @param {string} type Event type.
   * @param {Function|boolean=} fn Handler or propagate flag.
   * @param {Object=} context Context.
   * @param {boolean=} propagate Whether to check parents.
   * @return {boolean} Whether listens.
   */
  listens: function(type, fn, context, propagate) {
    if (typeof type !== 'string') {
      console.warn('"string" type argument expected');
    }
    let _fn = fn;
    if (typeof fn !== 'function') {
      propagate = !!fn;
      _fn = undefined;
      context = undefined;
    }
    const listeners = this._events && this._events[type];
    if (listeners && listeners.length) {
      if (this._listens(type, _fn, context) !== false) {
        return true;
      }
    }
    if (propagate) {
      for (const id in this._eventParents) {
        if (this._eventParents[id].listens(type, fn, context, propagate)) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Internal method to check for a listener.
   * @param {string} type Event type.
   * @param {Function=} fn Handler.
   * @param {Object=} context Context.
   * @return {number|boolean} Index or false.
   * @private
   */
  _listens: function(type, fn, context) {
    if (!this._events) {
      return false;
    }
    const listeners = this._events[type] || [];
    if (!fn) {
      return !!listeners.length;
    }
    if (context === this) {
      context = undefined;
    }
    for (let i = 0, len = listeners.length; i < len; i++) {
      if (listeners[i].fn === fn && listeners[i].ctx === context) {
        return i;
      }
    }
    return false;
  },

  /**
   * Adds a one-time event listener.
   * @param {string|Object} types Event type(s) or map.
   * @param {Function=} fn Handler.
   * @param {Object=} context Context.
   * @return {!Object} This.
   */
  once: function(types, fn, context) {
    if (typeof types === 'object') {
      for (const type in types) {
        this._on(type, types[type], fn, true);
      }
    } else {
      types = splitWords(types);
      for (let i = 0, len = types.length; i < len; i++) {
        this._on(types[i], fn, context, true);
      }
    }
    return this;
  },

  /**
   * Adds an event parent for propagation.
   * @param {!Object} obj Parent object.
   * @return {!Object} This.
   */
  addEventParent: function(obj) {
    this._eventParents = this._eventParents || {};
    this._eventParents[stamp(obj)] = obj;
    return this;
  },

  /**
   * Removes an event parent.
   * @param {!Object} obj Parent object.
   * @return {!Object} This.
   */
  removeEventParent: function(obj) {
    if (this._eventParents) {
      delete this._eventParents[stamp(obj)];
    }
    return this;
  },

  /**
   * Propagates an event to parents.
   * @param {!Object} e Event.
   * @private
   */
  _propagateEvent: function(e) {
    for (const id in this._eventParents) {
      this._eventParents[id].fire(e.type, extend({
        layer: e.target,
        propagatedFrom: e.target,
      }, e), true);
    }
  },
};

// Aliases for compatibility
Events.addEventListener = Events.on;
Events.removeEventListener = Events.off;
Events.addOneTimeEventListener = Events.once;
Events.fireEvent = Events.fire;
Events.hasEventListeners = Events.listens;

/**
 * Base class with event capabilities.
 * @extends {Class}
 */
const Evented = Class.extend(Events);

// Export for Section 2
// (Will be used in later sections)
