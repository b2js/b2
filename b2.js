//     B2.js 0.1.11

//     (c) 2014-2015 Percy Zhang
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
  B2.VERSION = '0.1.11';

  // Runs B2.js in *noConflict* mode, returning the `B2` variable
  // to its previous owner. Returns a reference to this B2 object.
  B2.noConflict = function () {
    root.B2 = previousB2;
    return this;
  };

  var localStorage = {};

  try {
    localStorage = window.localStorage;
  } catch (e) {
  }

  B2.localStorage = localStorage;

  B2.log = function () {
    if (B2.debug && window.console && window.console.log) {
        return console.log.apply(window.console, arguments);
    }
  };

  _.extend(B2, Backbone);

  // B2 root views are the views which has children view.(which called registerComponent method);
  B2.rootViews = {};

  // search component by unique name like B2.getComponentByUniqueName('')
  B2.getComponentByUniqueName = function (uniqName) {
    function findComponentByUniqName (components, uniqName) {
      var ret;

      _.each(components, function (component) {
        if (ret) { //  exit iteration early if already found component
          return false;
        }

        if (component._uuid + '_' + component._componentName === uniqName) {
          ret = component;
        } else {
          ret = findComponentByUniqName(component._components, uniqName);
        }
      });

      return ret;
    }

    return findComponentByUniqName(B2.rootViews, uniqName);
  };

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

    // config the events used to listen to the parent Views,
    // the format will be this
    // broadcastEvents: {
    // 	"eventName": "eventCallbackFunctionName"
    // }
    //
    broadcastEvents: {},

    // broadcast events to subviews
    // the format is
    // view.broadcast(eventName, arg1, arg2...);
    //
    broadcast: function () {
      var args = [].slice.apply(arguments);
      args.unshift('__broadcast__');
      this.trigger.apply(this, args);
    },

    // Register a sub view/component to the current view
    // the name is the name of the registered component
    // the container is a selector or element used as the dom container of the sub view
    registerComponent: function (name, component, container, dontRender) {
      if (this.isRemoved) {
        component.remove();
        B2.log('i am already removed, dont register components to me.', this._uuid, this._componentName);
        return component;
      }
      var i;

      //root component which is created by "new BackboneView" directly.
      if (!this._parentView) {
        B2.rootViews[this.cid] = this;
      }

      this._components = this._components || {};

      if (this._components.hasOwnProperty(name)) {
        var comp = this._components[name];

        if (comp.trigger) {
          comp.trigger('beforeRemove');
        }

        this.stopListening(comp, 'all');
        comp.remove();
      }


      this._components[name] = component;
      component._parentView = this;

      if (B2.rootViews[component.cid]) {
          delete B2.rootViews[component.cid];
      }

      component._componentName = name;
      component._uuid = _.uniqueId();

      component.$el.attr('data-component-unique-name', component._uuid + '_' + name);

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

              var func = this[funcName];
              for (i = 0; i < eventNames.length; i++) {
                // we handle 'all' event specifically
                if (eventNames[i] !== 'all') {
                  this.listenTo(component, eventNames[i], func);
                }
              }
            }
          }
        }
      }

      this.listenTo(component, 'all', function (eventName) {
        // while parentview trigger '__broadcast__' events to its subview, we do not want to delivery this event to the 'GrandpaView'
        if (eventName === '__broadcast__') {
          return;
        }

        if (this.appEvents.hasOwnProperty('all')) {
          var funcName = this.appEvents.all;

          // the 'all' event callback will get params as: cb('all', component, args...);
          this[funcName].apply(this, [arguments[0], component].concat(_.toArray(arguments).slice(1)));
        } else if (!component._events || !component._events[eventName]) {
          this.trigger.apply(this, arguments);
        }
      });

      component.listenTo(this, '__broadcast__', function () {
        var args = [].slice.apply(arguments);
        var eventName = args.shift();
        if (component.broadcastEvents.hasOwnProperty(eventName)) {
          var funcName = component.broadcastEvents[eventName];
          var func;
          if (_.isString(funcName)) {
            func = component[funcName];
          } else {
            func = funcName;
          }
          func.apply(component, args);
        }
        else {
          component.broadcast.apply(component, arguments);
        }
      });

      if (container) {
        if (_.isString(container)) {
          this.$(container).append(component.el);
        } else {
          $(container).append(component.el);
        }

        if (dontRender !== true) {
          component.render();
        }
      }

      return component;
    },

    /**
     * Get a component by the name
     * @param name
     * @returns {LM.View}
     */
    getComponent: function (name) {
      return this._components ? this._components[name] : null;
    },

    getComponents: function () {
      return this._components || {};
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
      if (_.isObject(params) && !_.isArray(params)) {
        var paramObj = params[fieldName];

        if (typeof paramObj == 'undefined') {
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

    // parse options when serializing a form, multiple options can be splited with colon(;)
    // currently, only support trim option
    //
    // format example:
    // data-serialize-opts="trim:true"                  trim the value when serialize the field
    // data-serialize-opts="opt1:true;opt2:10;opt3:11"
    _parseSerializeOpts: function (optsStr) {
      var optsObj = {};
      var opts = (optsStr || '').split(';');
      var valueMap = {
        'false': false,
        'true': true
      };

      _.each(opts, function (opt) {
        opt = opt.split(':');
        var opt0 = $.trim(opt[0]);
        var opt1= $.trim(opt[1]);
        optsObj[opt0] = _.isUndefined(valueMap[opt1]) ? opt1 : valueMap[opt1];
      });

      return _.defaults(optsObj, {
        trim: true
      });
    },

    // Encode a set of form elements as an array of names and values or as an params object
    // There are two points need to note:
    //	 1. if the name of the form controls is prefixed to a 'ignore',  then the controls will not be serialized to
    //    the result
    //
    // 2. we support to define a value2 to specify the value when the checkbox is not checked, default is false
    serializeForm: function (formEl, ignorePrefix, needArray, ignoredParentClass) {
      var that = this;
      formEl = formEl || this.el;
      var $paramEls = $(formEl).find('input, select, textarea')
          .filter(function () {
            var notInIgnoredForm = false;
            var $parent = $(this).closest('.' + ignoredParentClass);
            if ($parent.length === 0) {
              notInIgnoredForm = true;
            } else if (!$.contains(formEl, $parent[0])) {
              notInIgnoredForm = true;
            }
            // if the name of a element has a "ignore" prefix, it means not need to be serialized.
            return notInIgnoredForm && this.name && this.name.indexOf(ignorePrefix || 'ignore') === -1;
          });

      var params = {};

      if (needArray) {
        params = [];
      }

      $paramEls.each(function () {
        var $field = $(this);
        var fieldName = $field.attr('name');
        var serializeOpts = that._parseSerializeOpts($field.attr('data-serialize-opts'));
        var fieldValue = $field.val();
        fieldValue = serializeOpts.trim ? $.trim(fieldValue) : fieldValue;
        var fieldValue2 = $field.attr('value2');
        var isValidParam = true;
        var inverseValue = $field.attr('data-inverse-value');
        // if the element has a attr 'data-data-type-to-parse', it means this value will be parse to some data types.
        // now we support 'int', 'float' and it there is not this attr on element the value will still be javascript string.
        var valueDataType = $field.data('dataTypeToParse');

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
              } else {
                fieldValue = fieldValue2;
              }
            }

            if (inverseValue) {
              fieldValue = !fieldValue;
            }
            break;
          default:
            break;
        }

        if (_.isString(valueDataType)) {
          switch (valueDataType.toLowerCase()) {
            case 'int':
              var intValue = parseInt(fieldValue, 10);
              fieldValue = isNaN(intValue) ? fieldValue : intValue;
              break;
            case 'float':
              var floatValue = parseFloat(fieldValue);
              fieldValue = isNaN(floatValue) ? fieldValue : floatValue;
              break;
            default:
              break;
          }
        }

        if (isValidParam) {
          that._addFieldToFormParams(fieldName, fieldValue, params);
        }
      });

      return params;
    },

    // Like serializeForm, but only return an array
    serializeArray: function (formEl, ignorePrefix) {
      return this.serializeForm(formEl, ignorePrefix, true);
    },

    getParentView: function () {
      return this._parentView;
    },

    // override the default remove function of the Backbone.View
    // First, remove the sub views/components
    // Second, remove self from the parent view
    // Third, remove self
    remove: function () {
      // remove all children view
      this.freeChildren();

      this.trigger('beforeRemove');

      // remove self from parent view and stop all event listeners from parent which used to listen the child events
      var parentView = this._parentView;
      if (parentView) {
        parentView.stopListening(this);

        if (parentView._components) {
          delete parentView._components[this._componentName];
        }

        delete this._parentView;
      }

      if (B2.rootViews[this.cid]) {
          delete B2.rootViews[this.cid];
      }

      Backbone.View.prototype.remove.apply(this, arguments);

      this.isRemoved = true;
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

    var manageAjaxTest = /'manage ajax';/;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    for (var name in protoProps) {
      if (protoProps.hasOwnProperty(name)) {
        prototype[name] = typeof protoProps[name] == 'function' && ( manageAjaxTest.test(protoProps[name]) || (typeof _super[name] == 'function' &&
        (fnTest.test(protoProps[name]) || forceSuperMethods.indexOf(name) > -1)) ) ?

            (function (name, fn) {
              return function () {
                var tmp = this._super;

                if ( manageAjaxTest.test(fn) ) {
                  fn.viewId = '_' + this.cid + '_';
                }

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
        if (this.isRemoved) {
          B2.log('i am already removed, dont render me', this._uuid, this._componentName);
          return this;
        }
        if (this.onRenderBegin) {
          this.onRenderBegin();
        }
        if (this.freeChildren) {
          this.freeChildren();
        }

        var ret = _oldRender.apply(this, arguments);

        if (this.onRenderEnd) {
          this.onRenderEnd();
        }

        return ret;
      };
    }

    var SubView = _oldExtend.call(this, protoProps, staticProps, ['render']);

    SubView.prototype.events = _.extend({}, this.prototype.events, protoProps.events);
    SubView.prototype.appEvents = _.extend({}, this.prototype.appEvents, protoProps.appEvents);
    SubView.prototype.broadcastEvents = _.extend({}, this.prototype.broadcastEvents, protoProps.broadcastEvents);

    return SubView;
  };

}));
