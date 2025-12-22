const EventEmitter = require("events"); // 引入内置模块

// 继承 EventEmitter
class EventBus extends EventEmitter {
  constructor() {
    super(); // 必须调用 super()
    this.win = null;
    this.channel = "backend-event";
  }

  bindWindow(win) {
    this.win = win;
  }
  // 修改 EventBus 里的 log 方法
  log(...args) {
    const content = args
      .map((arg) => {
        if (arg instanceof Error) return arg.stack; // 打印堆栈
        if (typeof arg === "object") return JSON.stringify(arg);
        return arg;
      })
      .join(" ");

    this.emit("log", { msg: content });
  }
  /**
   * 封装插件专用 Emit
   * @param {string} plugName 插件名称/标识
   * @param {string} intent 意图/子事件名 (如 'status_change')
   * @param {any} data 携带的数据
   */
  plug_emit(plugName, intent, data = {}) {
    const eventName = "plug_event";
    const payload = {
      name: plugName,
      intent: intent,
      data: data,
    };

    // 触发后端 EventEmitter 监听 (例如插件内部 api.on('plug_emit', ...))
    this.emit(eventName, payload);

    // 注意：这里的 this.emit 已经包含了发送给前端 win.webContents.send 的逻辑
  }

  // 重写或扩展 emit 方法
  emit(eventName, payload = {}) {
    // 1. 调用父类方法：触发后端内部监听器（如插件绑定的 api.on）
    super.emit(eventName, payload);

    // 2. 原有逻辑：发送给前端渲染进程
    if (!this.win) {
      return;
    }
    this.win.webContents.send(this.channel, {
      event: eventName,
      payload,
    });
  }
}

module.exports = new EventBus();
