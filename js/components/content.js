(function(app) {
  'use strict';

  var jCore = require('jcore');
  var helper = app.helper || require('../helper.js');
  var Panel = app.Panel || require('./panel.js');

  var Content = jCore.Component.inherits(function() {
    this.movePanelsWithAnimation = this.prop(0);
    this.panels = [];
    this.draggable = new Content.Draggable(this);
  });

  Content.prototype.loadPanel = function(props) {
    var panel = new Panel(props);
    panel.parentElement(this.element());
    panel.redraw();
    this.panels.push(panel);
    return panel.load();
  };

  Content.prototype.removePanel = function(panel) {
    panel.parentElement(null);
    helper.remove(this.panels, panel);
  };

  Content.prototype.movePanels = function(dy) {
    if (this.panels.length === 0) {
      return;
    }
    var t = this.panels.reduce(function(t, panel) {
      return Math.max(t, panel.marginTop() / 2 - panel.top());
    }, Number.MIN_VALUE);
    if (dy > t) {
      dy = t;
    }
    this.panels.forEach(function(panel) {
      panel.top(panel.top() + dy);
    });
  };

  Content.prototype.oninit = function() {
    this.draggable.enable();
  };

  Content.prototype.onredraw = function() {
    this.redrawBy('movePanelsWithAnimation', function(rest) {
      if (this.panels.length === 0 || rest === 0) {
        return;
      }
      var dy = (rest > 0 ? 1 : -1) * Math.min(Math.abs(rest), 24);
      this.panels.forEach(function(panel) {
        panel.top(panel.top() + dy);
        panel.redraw();
      });
      setTimeout(function() {
        this.movePanelsWithAnimation(rest - dy);
      }.bind(this));
    });
  };

  Content.Draggable = (function() {
    var Draggable = jCore.Draggable.inherits();

    Draggable.prototype.onstart = function(content, x, y, event, context) {
      context.dy = 0;
    };

    Draggable.prototype.onmove = function(content, dx, dy, event, context) {
      content.movePanels(dy - context.dy);
      context.dy = dy;
    };

    Draggable.prototype.onend = function(content, dx, dy, event, context) {};

    return Draggable;
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Content;
  } else {
    app.Content = Content;
  }
})(this.app || (this.app = {}));
