var chai = require('chai');
var expect = chai.expect;
var B2 = require('../b2.js');
var jsdom = require("jsdom").jsdom;


describe('broad cast feature test', function () {
    before(function (done) {
        jsdom.env({
            html: "<html><head></head><body></body></html>>",
            done: function (errors, window) {
                global.window = window;
                global.document = window.document;
                global.Backbone = require('../node_modules/backbone/backbone.js');
                global.Backbone.$ = global.$ = require('../bower_components/jquery/dist/jquery.js');
                done();
            }
        });
    });

    it('Subview should get broadcast for its ParentView ', function (done) {

        var flag1 = {val: 'empty'};
        var flag2 = {val: 'empty'};

        var ChildView = B2.View.extend({
            broadcastEvents: {
                'event1': 'cb',
                'event2': function (flag, newValue) {
                    flag.val = newValue;
                }
            },
            cb: function (flag, newValue) {
                flag.val = newValue;
            }
        });

        var ParentView = B2.View.extend({
            initialize: function () {
                var childView = this.registerComponent('child', new ChildView({}), null, true);
                this.broadcast('event1', flag1, 'ah');
                expect(flag1.val).equal('ah');
                this.broadcast('event2', flag2, 'na');
                expect(flag2.val).equal('na');
                done();
            }
        });

        new ParentView({});
    });

    it('Subview should get unhandled broadcast from its Ancestor View by bubbling', function (done) {

        var flag1 = {val: 'grandpa'};
        var flag2 = {val: 'grandpa'};

        var ChildView = B2.View.extend({
            broadcastEvents: {
                'event1': 'cb',
                'event2': 'cb'
            },
            cb: function (flag) {
                flag.val += '->child';
            }
        });

        var ParentView = B2.View.extend({
            broadcastEvents: {
                'event1': 'cb'
            },
            cb: function (flag) {
                flag.val += '->parent';
            }
        });

        var GrandpaView = B2.View.extend({
            initialize: function () {
                var parentView = this.registerComponent('parent', new ParentView({}));
                var childsView = parentView.registerComponent('child', new ChildView({}))
            }
        });

        var grandpaView = new GrandpaView();
        grandpaView.broadcast('event1', flag1);
        grandpaView.broadcast('event2', flag2);

        expect(flag1.val).equal('grandpa->parent');
        expect(flag2.val).equal('grandpa->child');
        done();
    });

    it('While a view do broadcasting to its childView, its parentView should not noticed that', function (done) {

        var flag1 = {val: 'parent'};

        var ChildView = B2.View.extend({
            broadcastEvents: {
                'event1': 'cb',
            },
            cb: function (flag) {
                flag.val += '->child';
            }
        });

        var ParentView = B2.View.extend({});

        var GrandpaView = B2.View.extend({
            initialize: function () {
                var parentView = this.registerComponent('parent', new ParentView({}));
                var childsView = parentView.registerComponent('child', new ChildView({}))
            },
            appEvents: {
                'all': 'appEventsCallback'
            },
            appEventsCallback: function (eventName, self, flag) {
                flag.val = 'ah';
            }
        });

        var grandpaView = new GrandpaView();
        var parentView = grandpaView.getComponent('parent');

        parentView.broadcast('event1', flag1);
        expect(flag1.val).equal('parent->child');

        parentView.trigger('event1', flag1);
        expect(flag1.val).equal('ah');

        done();
    });
});
