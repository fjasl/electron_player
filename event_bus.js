// event_bus.js

class EventBus {
  constructor() {
    this.win = null;
    this.channel = "backend-event";
  }

  bindWindow(win) {
    this.win = win;
  }

  emit(eventName, payload = {}) {
    if (!this.win) {
      // console.warn("[EventBus] no window bound, event:", eventName);
      return;
    }
    this.win.webContents.send(this.channel, {
      event: eventName,
      payload,
    });
  }
}

module.exports = new EventBus();
