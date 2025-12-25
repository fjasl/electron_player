const { screen } = require("electron");

class WindowHidePlugin {
  constructor() {
    this.name = "WindowHidePlugin";
    this.api = null;
    this.config = {
      threshold: 50, // 增加到50，测试时更容易触发
      gap: 5, // 增加到5，方便肉眼观察
      animate: true,
    };
    this.currentEdge = null;
  }

  activate(api) {
    this.api = api;
    this.api.log("插件 activate 函数开始执行...");

    if (this.api.winPasser) {
      this.api.log("检测到 winPasser，正在设置置顶...");
      this.api.winPasser.setAlwaysOnTop(true, "screen-saver");
    } else {
      this.api.log("CRITICAL: api.winPasser 为空，无法操作窗口！");
    }

    // 1. 鼠标进入
    this.api.registerIntent("window_event_mouse_enter", () => {
      this.api.log("收到意图: mouse_enter");
      this.handleWindowEvent("mouse_enter");
    });

    // 2. 鼠标离开
    this.api.registerIntent("window_event_mouse_leave", () => {
      this.api.log("收到意图: mouse_leave");
      this.handleWindowEvent("mouse_leave");
    });

    // 3. 窗口聚焦
    this.api.registerIntent("window_event_focus", () => {
      this.api.log("收到意图: focus");
      this.handleWindowEvent("focus");
    });

    // 4. 窗口失焦
    this.api.registerIntent("window_event_blur", () => {
      this.api.log("收到意图: blur");
      this.handleWindowEvent("blur");
    });

    this.api.log("四向贴边隐藏插件已激活并注册 Intent 完毕");
  }

  handleWindowEvent(type) {
    const win = this.api.winPasser;
    if (!win) return;

    if (type === "mouse_enter") {
      this.expand(win);
    } else if (type === "mouse_leave" || type === "blur") {
      this.retract(win);
    }
  }

  getWorkArea(win) {
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    this.api.log(
      `匹配显示器: ${display.id}, 工作区: ${JSON.stringify(display.workArea)}`
    );
    return display.workArea;
  }

  retract(win) {
    const bounds = win.getBounds();
    const area = this.getWorkArea(win);
    let target = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
    this.currentEdge = null;

    this.api.log(
      `执行 retract 检查。当前窗口坐标: x:${bounds.x}, y:${bounds.y}, w:${bounds.width}`
    );
    this.api.log(
      `触发阈值: ${this.config.threshold}, 屏幕右边缘: ${area.x + area.width}`
    );

    // 1. 左边
    if (bounds.x <= area.x + this.config.threshold) {
      target.x = area.x - bounds.width + this.config.gap;
      this.currentEdge = "left";
    }
    // 2. 右边 (注意计算逻辑: 窗口右侧坐标 >= 屏幕总宽 - 阈值)
    else if (
      bounds.x + bounds.width >=
      area.x + area.width - this.config.threshold
    ) {
      target.x = area.x + area.width - this.config.gap;
      this.currentEdge = "right";
    }
    // 3. 顶边
    else if (bounds.y <= area.y + this.config.threshold) {
      target.y = area.y - bounds.height + this.config.gap;
      this.currentEdge = "top";
    }

    if (this.currentEdge) {
      this.api.log(
        `确认贴边! 方向: ${this.currentEdge}, 目标坐标: x:${target.x}, y:${target.y}`
      );
      win.setBounds(target, this.config.animate);
    } else {
      this.api.log("未检测到贴边：窗口距离边缘太远，不执行缩回。");
    }
  }

  expand(win) {
    this.api.log(`执行 expand 检查。当前状态 currentEdge: ${this.currentEdge}`);

    if (!this.currentEdge) {
      this.api.log("忽略弹出: 当前没有被标记为隐藏状态");
      return;
    }

    const bounds = win.getBounds();
    const area = this.getWorkArea(win);
    let target = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };

    switch (this.currentEdge) {
      case "left":
        target.x = area.x;
        break;
      case "right":
        target.x = area.x + area.width - bounds.width;
        break;
      case "top":
        target.y = area.y;
        break;
    }

    this.api.log(`弹出窗口! 目标坐标: x:${target.x}, y:${target.y}`);
    win.setBounds(target, this.config.animate);
    this.currentEdge = null;
  }

  deactivate() {
    this.api.log("窗口自动隐藏插件已禁用");
  }
}

module.exports = WindowHidePlugin;
