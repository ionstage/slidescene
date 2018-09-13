(function(app) {
  'use strict';

  var jCore = require('jcore');
  var dom = app.dom || require('../dom.js');
  var Content = app.Content || require('./content.js');
  var Medal = app.Medal || require('./medal.js');
  var MuteButton = app.MuteButton || require('./mute-button.js');
  var Sound = app.Sound || require('../controllers/sound.js');

  var Main = jCore.Component.inherits(function() {
    this.sound = new Sound();
    this.content = new Content({ element: this.findElement('.content') });
    this.medal = new Medal({ element: this.findElement('.medal') });
    this.muteButton = new MuteButton({ element: this.findElement('.mute-button') });
  });

  Main.prototype.oninit = function() {
    this.content.on('medal', this.onmedal.bind(this));
    this.content.on('sound', this.onsound.bind(this));
    this.muteButton.on('mute', this.onmute.bind(this));
    this.muteButton.on('unmute', this.onunmute.bind(this));
    this.content.load().then(function() {
      dom.on(this.element(), 'keydown', this.onkeydown.bind(this));
      dom.on(this.element(), 'wheel', this.onwheel.bind(this));
    }.bind(this));
  };

  Main.prototype.onkeydown = (function() {
    var map = {
      37: 'moveLeft',
      38: 'moveUp',
      39: 'moveRight',
      40: 'moveDown',
    };
    return function(event) {
      var key = map[dom.which(event)];
      if (key) {
        dom.cancel(event);
        this.content[key]();
      }
    };
  })();

  Main.prototype.onwheel = (function() {
    var context = {};
    var dy = 0;
    var isStart = false;
    var timeoutID = 0;
    return function(event) {
      if (!isStart) {
        this.content.draggable.onstart(this.content, 0, -1, event, context);
        isStart = true;
      }
      dy -= dom.deltaY(event);
      this.content.draggable.onmove(this.content, 0, dy, event, context);
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
      timeoutID = setTimeout(function() {
        this.content.draggable.onend(this.content, 0, dy, event, context);
        dy = 0;
        isStart = false;
        timeoutID = 0;
      }.bind(this), 100);
    };
  })();

  Main.prototype.onmedal = function(medal) {
    this.medal.load(medal);
  };

  Main.prototype.onsound = function(sound) {
    this.sound.change(sound);
  };

  Main.prototype.onmute = function() {
    this.sound.mute();
  };

  Main.prototype.onunmute = function() {
    this.sound.unmute();
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Main;
  } else {
    app.Main = Main;
  }
})(this.app || (this.app = {}));
