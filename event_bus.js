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
  log(content) {
    // 这里的 { msg: content } 就会生成前端需要的格式
    // 例如：eventBus.log("hello") -> 发送的是 { msg: "hello" }
    this.emit("log", { msg: content });
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
