const { screen } = require("electron");

class WindowHidePlugin {
  constructor() {
    this.name = "WindowHidePlugin";
    this.api = null;

    this.config = {
      threshold: 50,
      gap: 5,
      animate: true,
      expandDuration: 180, // ms
      expandFPS: 60,
    };

    this.currentEdge = null;
    this.expandedBounds = null;
    this.isAnimating = false;
    this.ignoreLeaveUntil = 0;
  }

  activate(api) {
    this.api = api;

    if (this.api.winPasser) {
      this.api.winPasser.setAlwaysOnTop(true, "screen-saver");
    }

    this.api.registerIntent("window_event_mouse_enter", () =>
      this.handleEvent("enter")
    );
    this.api.registerIntent("window_event_mouse_leave", () =>
      this.handleEvent("leave")
    );
    this.api.registerIntent("window_event_focus", () =>
      this.handleEvent("focus")
    );
    this.api.registerIntent("window_event_blur", () =>
      this.handleEvent("blur")
    );
  }

  handleEvent(type) {
    const win = this.api.winPasser;
    if (!win || this.isAnimating) return;

    if (type === "enter") {
      this.expand(win);
      return;
    }

    if (type === "leave" || type === "blur") {
      if (Date.now() < this.ignoreLeaveUntil) return;
      this.retract(win);
    }
  }

  getWorkArea(win) {
    const bounds = win.getBounds();
    return screen.getDisplayMatching(bounds).workArea;
  }

  retract(win) {
    if (this.currentEdge) return;

    const bounds = win.getBounds();
    const area = this.getWorkArea(win);

    let target = { ...bounds };
    let edge = null;

    if (bounds.x <= area.x + this.config.threshold) {
      edge = "left";
      target.x = area.x - bounds.width + this.config.gap;
    } else if (
      bounds.x + bounds.width >=
      area.x + area.width - this.config.threshold
    ) {
      edge = "right";
      target.x = area.x + area.width - this.config.gap;
    } else if (bounds.y <= area.y + this.config.threshold) {
      edge = "top";
      target.y = area.y - bounds.height + this.config.gap;
    }

    if (!edge) return;

    this.expandedBounds = { ...bounds };
    this.currentEdge = edge;

    this.isAnimating = true;
    win.setBounds(target, false);

    setTimeout(() => {
      this.isAnimating = false;
    }, 100);
  }

  expand(win) {
    if (!this.currentEdge || !this.expandedBounds) return;

    const start = win.getBounds();
    const end = this.expandedBounds;

    this.isAnimating = true;
    this.ignoreLeaveUntil = Date.now() + 300;

    this.animateBounds(win, start, end, () => {
      this.isAnimating = false;
      this.currentEdge = null;
      this.expandedBounds = null;
    });
  }

  animateBounds(win, from, to, done) {
    const frames = Math.max(
      1,
      Math.floor((this.config.expandDuration / 1000) * this.config.expandFPS)
    );

    let frame = 0;

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const timer = setInterval(() => {
      frame++;
      const t = easeOut(frame / frames);

      const x = Math.round(from.x + (to.x - from.x) * t);
      const y = Math.round(from.y + (to.y - from.y) * t);

      win.setBounds(
        {
          x,
          y,
          width: from.width,
          height: from.height,
        },
        false
      );

      if (frame >= frames) {
        clearInterval(timer);
        win.setBounds(to, false);
        done?.();
      }
    }, 1000 / this.config.expandFPS);
  }

  deactivate() {
    this.api.log("WindowHidePlugin deactivated");
  }
}

module.exports = WindowHidePlugin;
