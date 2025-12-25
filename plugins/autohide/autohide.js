const { screen } = require("electron");

class WindowHidePlugin {
  constructor() {
    this.name = "WindowHidePlugin";
    this.api = null;

    this.config = {
      threshold: 50,
      gap: 5,
      animate: true,
    };

    // ====== 关键状态 ======
    this.currentEdge = null;      // left | right | top | null
    this.expandedBounds = null;   // 记录“完全展开时”的真实位置
    this.isAnimating = false;     // 防止抖动
    this.ignoreLeaveUntil = 0;    // expand 后短时间内忽略 mouse_leave
  }

  activate(api) {
    this.api = api;
    this.api.log("WindowHidePlugin activate");

    if (this.api.winPasser) {
      this.api.winPasser.setAlwaysOnTop(true, "screen-saver");
    }

    this.api.registerIntent("window_event_mouse_enter", () => {
      this.handleEvent("enter");
    });

    this.api.registerIntent("window_event_mouse_leave", () => {
      this.handleEvent("leave");
    });

    this.api.registerIntent("window_event_focus", () => {
      this.handleEvent("focus");
    });

    this.api.registerIntent("window_event_blur", () => {
      this.handleEvent("blur");
    });
  }

  handleEvent(type) {
    const win = this.api.winPasser;
    if (!win || this.isAnimating) return;

    if (type === "enter") {
      this.expand(win);
      return;
    }

    if (type === "leave" || type === "blur") {
      // expand 后短时间内禁止 retract
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

    // 只在第一次 retract 时记录原始位置
    this.expandedBounds = { ...bounds };
    this.currentEdge = edge;

    this.isAnimating = true;
    win.setBounds(target, this.config.animate);

    setTimeout(() => {
      this.isAnimating = false;
    }, 200);
  }

  expand(win) {
    if (!this.currentEdge || !this.expandedBounds) return;

    this.isAnimating = true;
    win.setBounds(this.expandedBounds, this.config.animate);

    // expand 后给一个“安全期”，防止立刻 mouse_leave
    this.ignoreLeaveUntil = Date.now() + 300;

    setTimeout(() => {
      this.isAnimating = false;
      this.currentEdge = null;
      this.expandedBounds = null;
    }, 200);
  }

  deactivate() {
    this.api.log("WindowHidePlugin deactivated");
  }
}

module.exports = WindowHidePlugin;
