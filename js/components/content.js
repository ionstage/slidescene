(function(app) {
  'use strict';

  var jCore = require('jcore');
  var helper = app.helper || require('../helper.js');
  var dom = app.dom || require('../dom.js');
  var Panel = app.Panel || require('./panel.js');

  var Content = jCore.Component.inherits(function() {
    this.medal = this.prop('');
    this.sound = this.prop('');
    this.moveWithAnimation = this.prop(0);
    this.isLoading = this.prop(false);
    this.panels = [];
    this.draggable = new Content.Draggable(this);
  });

  Content.prototype.visiblePanels = function() {
    return this.panels.filter(function(panel) {
      return panel.visible();
    }).sort(function(a, b) {
      return a.bottom() - b.bottom();
    });
  };

  Content.prototype.hasNextVisiblePanel = function(panel) {
    return this.panels.some(function(next) {
      return (next.previous === panel && next.visible());
    });
  };

  Content.prototype.panelFromTop = function(top) {
    return helper.find(this.panels, function(panel) {
      return (panel.top() <= top && panel.bottom() > top && panel.visible());
    });
  };

  Content.prototype.data = function() {
    return {
      medal: this.medal(),
      panels: this.panels.map(function(panel) {
        return {
          top: panel.top(),
          visible: panel.visible(),
          url: panel.url(),
          medal: panel.medal(),
          previous: this.panels.indexOf(panel.previous),
        };
      }.bind(this)),
    };
  };

  Content.prototype.load = function() {
    var data = dom.load('data', null);
    if (data) {
      return this.loadFromCache(data.medal, data.panels).then(this.onload.bind(this));
    }
    return this.loadDefault().then(this.onload.bind(this));
  };

  Content.prototype.loadDefault = function() {
    return this.loadPanel({
      top: -24,
      url: 'scenes/index.html',
      medal: '',
    }).then(function(p) {
      this.onmedal(p.medal());
      p.visible(true);
      return this.loadNewPanels();
    }.bind(this)).then(function() {
      this.removePanel(this.panels[0]);
    }.bind(this));
  };

  Content.prototype.loadFromCache = function(medal, panels) {
    this.onmedal(medal);
    return panels.reduce(function(promise, panel) {
      return promise.then(function() {
        return this.loadPanel({
          top: panel.top,
          url: panel.url,
          medal: panel.medal,
        }).then(function(p) {
          p.visible(panel.visible);
        });
      }.bind(this));
    }.bind(this), Promise.resolve()).then(function() {
      this.panels.forEach(function(panel, index) {
        var index = panels[index].previous;
        if (index !== -1) {
          panel.previous = this.panels[index];
        }
      }.bind(this));
    }.bind(this));
  };

  Content.prototype.loadPanel = function(props) {
    var panel = new Panel({
      top: props.top,
      previous: props.previous,
    });
    panel.parentElement(this.element());
    panel.redraw();
    this.panels.push(panel);
    return panel.load(props.url, props.medal).then(function(panel) {
      panel.on('animationend', this.onpanelanimationend.bind(this));
      return panel;
    }.bind(this));
  };

  Content.prototype.loadNextPanel = function(panel) {
    var next = panel.next();
    if (!next) {
      return Promise.resolve();
    }
    return this.loadPanel({
      top: panel.bottom(),
      previous: panel,
      url: 'scenes/' + next + '.html',
      medal: this.medal(),
    });
  };

  Content.prototype.loadNewPanel = function() {
    var visiblePanels = this.visiblePanels();
    if (visiblePanels.length === 0) {
      return Promise.resolve();
    }
    var first = visiblePanels[0];
    var last = visiblePanels[visiblePanels.length - 1];
    if (last.bottom() > dom.offsetHeight(this.element()) + first.height()) {
      return Promise.resolve();
    }
    return this.loadNextPanel(last).then(function(panel) {
      if (panel && panel.medal() === this.medal()) {
        panel.visible(true);
        return this.loadNewPanel();
      }
    }.bind(this));
  };

  Content.prototype.loadNewPanels = function() {
    if (this.isLoading()) {
      return Promise.resolve();
    }
    this.isLoading(true);
    return this.loadNewPanel().then(function() {
      this.isLoading(false);
    }.bind(this));
  };

  Content.prototype.save = function() {
    dom.save('data', this.data());
  };

  Content.prototype.showPanel = function(panel) {
    panel.visible(true);
    panel.redraw();
    var nextPanel = this.panels.filter(function(next) {
      return (next.previous === panel && next.medal() === panel.medal());
    })[0];
    if (nextPanel) {
      this.showPanel(nextPanel);
    }
  };

  Content.prototype.removePanel = function(panel) {
    panel.removeAllListeners();
    panel.parentElement(null);
    helper.remove(this.panels, panel);
  };

  Content.prototype.move = function(dy) {
    var minTop = this.panels.reduce(function(top, panel) {
      return (panel.visible() ? Math.min(top, panel.top()) : top);
    }, Number.MAX_VALUE);
    if (minTop + dy > 0) {
      // don't show an area above the top panel
      dy = -minTop;
    }
    if (dy === 0) {
      return;
    }
    this.panels.forEach(function(panel) {
      panel.top(panel.top() + dy);
    });
  };

  Content.prototype.moveUp = function() {
    var panel = this.panelFromTop(0);
    if (!panel) {
      return;
    }
    this.moveWithAnimation(-panel.top());
  };

  Content.prototype.moveDown = function() {
    var panel = this.panelFromTop(0);
    if (!panel) {
      return;
    }
    if (this.hasNextVisiblePanel(panel)) {
      this.moveWithAnimation(-panel.bottom());
    }
  };

  Content.prototype.moveLeft = function() {
    var panel = this.panelFromTop(0);
    if (!panel) {
      return;
    }
    if (panel.canScrollToLeft()) {
      panel.scrollToLeft();
    }
  };

  Content.prototype.moveRight = function() {
    var panel = this.panelFromTop(0);
    if (!panel) {
      return;
    }
    if (panel.canScrollToRight()) {
      panel.scrollToRight();
    }
  };

  Content.prototype.onredraw = function() {
    this.redrawBy('moveWithAnimation', function(rest) {
      if (this.panels.length === 0) {
        return;
      }
      if (rest === 0) {
        setTimeout(this.emit.bind(this), 0, 'animationend');
        return;
      }
      var dy = (rest > 0 ? 1 : -1) * Math.min(Math.abs(rest), 24);
      this.panels.forEach(function(panel) {
        panel.top(panel.top() + dy);
        panel.redraw();
      });
      setTimeout(this.moveWithAnimation.bind(this), 0, rest - dy);
    });
  };

  Content.prototype.onload = function() {
    this.onsound();
    this.save();
    this.on('animationend', this.onanimationend.bind(this));
    this.draggable.enable();
  };

  Content.prototype.onanimationend = function() {
    var panel = this.panelFromTop(0);
    if (!panel || panel.top() !== 0) {
      return;
    }

    // remove panels located on the out of the window
    this.panels.slice().forEach(function(panel) {
      if (panel.bottom() <= 0) {
        this.removePanel(panel);
      }
    }.bind(this));

    this.loadNewPanels().then(function() {
      this.onsound();
      this.save();
    }.bind(this));
  };

  Content.prototype.onpanelanimationend = function(panel) {
    if (this.panels.indexOf(panel) === -1 || !panel.visible()) {
      // already removed or invisible
      return;
    }

    var medal = panel.medal();
    if (medal !== this.medal()) {
      this.onmedal(medal);
    }

    // hide next panels
    var visiblePanels = this.visiblePanels();
    visiblePanels.slice(visiblePanels.indexOf(panel) + 1).forEach(function(panel) {
      panel.visible(false);
      panel.redraw();
    });

    // show next panels
    this.showPanel(panel);
    this.loadNewPanels().then(function() {
      this.save();
    }.bind(this));
  };

  Content.prototype.onmedal = function(medal) {
    this.medal(medal);
    this.emit('medal', medal);
  };

  Content.prototype.onsound = function() {
    var visiblePanels = this.visiblePanels();
    if (visiblePanels.length === 0) {
      return;
    }
    var sound = visiblePanels[0].sound();
    if (sound === this.sound()) {
      return;
    }
    this.sound(sound);
    this.emit('sound', sound);
  };

  Content.Draggable = (function() {
    var Draggable = jCore.Draggable.inherits();

    Draggable.prototype.onstart = function(content, x, y, event, context) {
      dom.cancel(event);
      context.dy = 0;
      context.ddy = 0;
      context.dx = 0;
      context.ddx = 0;
      context.lockY = false;
      context.lockX = false;
      context.panel = content.panelFromTop(y);
      content.moveWithAnimation(0);
      if (context.panel) {
        context.panel.scrollWithAnimation(0);
      }
    };

    Draggable.prototype.onmove = function(content, dx, dy, event, context) {
      if (content.panels.length === 0) {
        return;
      }
      if (!context.lockY && !context.lockX) {
        context.lockY = (Math.abs(dy) >= 24);
      }
      if (!context.lockY && !context.lockX) {
        context.lockX = (Math.abs(dx) >= 24);
      }
      if (!context.lockX) {
        this.onmovey(content, dx, dy, event, context);
      }
      if (!context.lockY) {
        this.onmovex(content, dx, dy, event, context);
      }
    };

    Draggable.prototype.onmovey = function(content, dx, dy, event, context) {
      var ddy = dy - context.dy;
      if (ddy === 0) {
        return;
      }
      context.dy = dy;
      context.ddy = ddy;
      content.move(ddy);
    };

    Draggable.prototype.onmovex = function(content, dx, dy, event, context) {
      if (!context.panel) {
        return;
      }
      var ddx = dx - context.dx;
      if (ddx === 0) {
        return;
      }
      context.dx = dx;
      context.ddx = ddx;
      context.panel.scroll(ddx);
    };

    Draggable.prototype.onend = function(content, dx, dy, event, context) {
      if (content.panels.length === 0) {
        return;
      }
      this.onendy(content, dx, dy, event, context);
      this.onendx(content, dx, dy, event, context);
    };

    Draggable.prototype.onendy = function(content, dx, dy, event, context) {
      // find that a part of the panel located on the out of the window
      var overflowPanel = content.panelFromTop(0);
      if (!overflowPanel) {
        var maxTop = content.panels.reduce(function(top, panel) {
          return (panel.visible() ? Math.max(top, panel.top()) : top);
        }, -Number.MAX_VALUE);
        if (maxTop < 0) {
          // all panels are located on the out of the window
          content.moveWithAnimation(-maxTop);
        }
        return;
      }
      var d;
      if (content.hasNextVisiblePanel(overflowPanel)) {
        var top = overflowPanel.top();
        var bottom = overflowPanel.bottom();
        if (top <= -24 && bottom >= 24) {
          d = (context.ddy > 0 ? -top : -bottom);
        } else {
          d = (-top < bottom ? -top : -bottom);
        }
      } else {
        // leave the last panel
        d = -overflowPanel.top();
      }
      content.moveWithAnimation(d);
      if (d === 0 && context.ddy !== 0) {
        // XXX: no need to move panels but handle 'animationend' event
        content.onanimationend();
      }
    };

    Draggable.prototype.onendx = function(content, dx, dy, event, context) {
      var panel = context.panel;
      if (!panel) {
        return;
      }
      var d;
      var left = panel.left();
      var right = panel.right();
      if (left <= -24 && right >= 24) {
        d = (context.ddx > 0 ? -left : -right);
      } else {
        d = (-left < right ? -left : -right);
      }
      panel.scrollWithAnimation(d);
      if (d === 0 && context.ddx !== 0) {
        // XXX: no need to scroll panel but handle 'animationend' event
        content.onpanelanimationend(panel);
      }
    };

    return Draggable;
  })();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Content;
  } else {
    app.Content = Content;
  }
})(this.app || (this.app = {}));
