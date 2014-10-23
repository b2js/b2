//     B2.js 0.1.3

//     (c) 2014-2014 Percy Zhang
//     B2 may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://b2js.org

(function (root, factory) {

  // Set up B2 appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['backbone', 'underscore', 'jquery', 'exports'], function (Backbone, _, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global B2.
      root.B2 = factory(root, exports, Backbone, _, $);
    });

    // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var Backbone = require('backbone');
    var _ = require('underscore');
    factory(root, exports, Backbone, _);

    // Finally, as a browser global.
  } else {
    root.B2 = factory(root, {}, root.Backbone, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function (root, B2, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `B2` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousB2 = root.B2;

  // Current version of the library. Keep in sync with `package.json`.
  B2.VERSION = '0.1.3';

  // Runs B2.js in *noConflict* mode, returning the `B2` variable
  // to its previous owner. Returns a reference to this B2 object.
  B2.noConflict = function() {
    root.B2 = previousB2;
    return this;
  };

  var localStorage = {};

  try {
	localStorage = window.localStorage;
  } catch(e) {
  }

  B2.localStorage = localStorage;

  _.extend(B2, Backbone);

  // B2.View
  // -------------

  // B2 Views extend from Backbone.View, and support useful features
  // we can register a sub view to current view by call registerComponent method.
  // we can get the registered component.
  // we can free/remove the registered component by name or regex pattern.
  // we can listen to the events triggered on the subviews, and the events can be
  // transparently delegated to the ancestor views.
  B2.View = Backbone.View.extend({

    // Define a default template function return empty string
    template: function () {
      return '';
    },

    // config the events used to listen to the subviews which are registered by registerComponent,
    // the format will be this
    // appEvents: {
    // 	"eventName componentName": "eventCallbackFunctionName"
    // }
    //
    appEvents: {

    },

    // Register a sub view/component to the current view
    // the name is the name of the registered component
    // the container is a selector or element used as the dom container of the sub view
    registerComponent: function (name, component, container) {
      var i;

      this._components = this._components || {};

      if (this._components.hasOwnProperty(name)) {
        var comp = this._components[name];

        if (comp.trigger) {
          comp.trigger('beforeRemove');
        }

        this.stopListening(comp, 'all');
        comp.remove();
      }

      if (container) {
        if (_.isString(container)) {
          this.$(container).append(component.el);
        } else {
          $(container).append(component.el);
        }
        component.render();
      }

      this._components[name] = component;
      component._parentView = this;
      component._componentName = name;

      var delegateEventSplitter = /^(\S+)\s*(\S+)$/;

      for (var key in this.appEvents) {
        if (this.appEvents.hasOwnProperty(key)) {
          var funcName = this.appEvents[key];
          var match = key.match(delegateEventSplitter);
          var eventName = match[1],
            selector = match[2];

          if (match && selector) {
            // if select is a regexp
            var selectorExp = /\/(.*?)\//.exec(selector);
            var regSelector = selectorExp && selectorExp[1];

            if (regSelector) {
              selector = new RegExp(regSelector.replace(/\\/g, '\\\\'));
            }
          }

          if (selector) {
            var matched = false;
            if (_.isRegExp(selector) && selector.test(name)) {
              matched = true;
            } else if (selector == name) {
              matched = true;
            }

            if (matched) {
              var eventNames = eventName.split(/,/);

              for (i = 0; i < eventNames.length; i++) {
                this.listenTo(component, eventNames[i], this[funcName]);
              }
            }
          }
        }
      }

      this.listenTo(component, 'all', function (eventName) {
        if (this.appEvents.hasOwnProperty('all')) {
          var funcName = this.appEvents.all;
          this[funcName].apply(this, [arguments[0], component].concat(_.toArray(arguments).slice(1)));
        } else if (!component._events || !component._events[eventName]) {
          this.trigger.apply(this, arguments);
        }
      });

      return this;
    },

    /**
     * Get a component by the name
     * @param name
     * @returns {LM.View}
     */
    getComponent: function (name) {
      return this._components[name];
    },

    getComponents: function () {
      return this._components;
    },

    // Remove some subviews or all subviews from current view
    // toRemove argument means only the specified components will be removed. Leave undefined to remove all subviews
    freeChildren: function (toRemove) {
      _.each(this._components, function (component, name) {
        var removeFlag = false;

        if (toRemove) {
          if (_.isRegExp(toRemove)) {
            removeFlag = toRemove.test(name);
          } else {
            removeFlag = toRemove === name || toRemove === component;
          }
        } else {
          removeFlag = true;
        }

        if (removeFlag) {
          this.stopListening(component, 'all');

          component.remove();

          if (this._components[name]) {
            delete this._components[name];
            delete component._parentView;
          }
        }
      }, this);
    },

    _addFieldToFormParams: function (fieldName, fieldValue, params) {
      if (_.isObject(params)) {
        var paramObj = params[fieldName];

        if (typeof paramObj == 'undefined')  {
          params[fieldName] = fieldValue;
        } else if (!_.isArray(paramObj)) {
	      var oldValue = paramObj;
          params[fieldName] = [oldValue];
	      params[fieldName].push(fieldValue);
        } else if (_.isArray(paramObj)) {
	        paramObj.push(fieldValue);
        }
      } else if (_.isArray(params)) {
        params.push({
          name: fieldName,
          value: fieldValue
        });
      }
    },

    // Encode a set of form elements as an array of names and values or as an params object
    serializeForm: function (formEl, ignorePrefix, needArray) {
	  var that = this;
      var $paramEls = $(formEl || this.el).find('input, select, textarea')
        .filter(function () {
          // if the name of a element has a "ignore" prefix, it means not need to be serialized.
          return this.name && this.name.indexOf(ignorePrefix || 'ignore') === -1;
        });

      var params = {};

      if (needArray) {
        params = [];
      }

      $paramEls.each(function () {
        var $field = $(this);
        var fieldName = $field.attr('name');
        var fieldValue = $field.val();
        var fieldValue2 = $field.attr('value2');
        var isValidParam = true;

        switch ($field.prop('type')) {
          case 'radio':
            if ($field.prop('checked')) {
              fieldName = $field.attr('name');
            } else {
              isValidParam = false;
            }
            break;
          case 'checkbox':
            if ($field.prop('checked')) {
              // we support to define a value to specify the value when the checkbox is checked, default is true
              if (fieldValue == null || fieldValue == 'on') {
                fieldValue = true;
              }
            } else {
              // we support to define a value2 to specify the value when the checkbox is not checked, default is false
              if (fieldValue2 == null) {
                fieldValue = false;
              }
            }
            break;
          default:
            break;
        }

        that._addFieldToFormParams(fieldName, fieldValue, params);
      });

      return params;
    },

    // Like serializeForm, but only return an array
    serializeArray: function (formEl, ignorePrefix) {
      return this.serializeForm(formEl, ignorePrefix, true);
    },


    // override the default remove function of the Backbone.View
    // First, remove the sub views/components
    // Second, remove self from the parent view
    // Third, remove self
    remove: function () {
      // remove all children view
      this.freeChildren();

      // remove self from parent view and stop all event listeners from parent which used to listen the child events
      var parentView = this._parentView;
      if (parentView) {
        parentView.stopListening(this, 'all');

        if (parentView._components) {
          delete parentView._components[this._componentName];
        }

        delete this._parentView;
      }

      this.trigger('beforeRemove');
      Backbone.View.prototype.remove.apply(this, arguments);
    },

    // the default render function
    render: function () {
      this.$el.html(this.template());
    }
  });

  // B2.Model
  // --------------
  B2.Model = Backbone.Model.extend({

  });

  // B2.Collection
  // --------------
  B2.Collection = Backbone.Collection.extend({

  });

  // B2.Router
  // --------------
  B2.Router = Backbone.Router.extend({

  });

  // B2.Router
  // --------------
  B2.History = Backbone.History.extend({

  });

  // Rewrite backbone extend to support multi-level inheritance, and support this._super convention.
  // See: http://stackoverflow.com/questions/10008285/preventing-infinite-recursion-when-using-backbone-style-prototypal-inheritance
  var extend = function (protoProps, staticProps, forceSuperMethods) {

    forceSuperMethods = forceSuperMethods || [];

    var parent = this;
    var child;
    var _super = parent.prototype;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function () {
        return parent.apply(this, arguments);
      };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function () {
      this.constructor = child;
    };
    Surrogate.prototype = parent.prototype;
    var prototype = child.prototype = new Surrogate();
    var fnTest = /xyz/.test(function () {
      return 'xyz';
    }) ? /\b_super\b/ : /.*/;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    for (var name in protoProps) {
      if (protoProps.hasOwnProperty(name)) {
        prototype[name] = typeof protoProps[name] == 'function' && typeof _super[name] == 'function' &&
          (fnTest.test(protoProps[name]) || forceSuperMethods.indexOf(name) > -1) ?

          (function (name, fn) {
            return function () {
              var tmp = this._super;

              // Add a new ._super() method that is the same method but on the super-class
              this._super = _super[name];

              // The method only need to be bound temporarily, so we
              // remove it when we're done executing
              var ret = fn.apply(this, arguments);

              this._super = tmp;

              return ret;
            };
          })(name, protoProps[name]) : // jshint ignore:line

          protoProps[name];
      }
    }

    // Set a convenience property in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  B2.Model.extend = B2.Collection.extend = B2.Router.extend = B2.View.extend = B2.History.extend = extend;

  var _oldExtend = B2.View.extend;
  // redefine extend to inject the freeChildren method at the top of the render to prevent memory leak
  B2.View.extend = function (protoProps, staticProps) {
    if (protoProps.render) {
      var _oldRender = protoProps.render;
      protoProps.render = function () {
        if (this.freeChildren) {
          this.freeChildren();
        }

        return _oldRender.apply(this, arguments);
      };
    }

    var SubView = _oldExtend.call(this, protoProps, staticProps, ['render']);

    SubView.prototype.events = _.extend({}, this.prototype.events, protoProps.events);
    SubView.prototype.appEvents = _.extend({}, this.prototype.appEvents, protoProps.appEvents);

    return SubView;
  };

}));
