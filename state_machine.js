// state_machine.js
const stateStore = require("./units/state_store");
const storage = require("./units/storage");
const eventBus = require("./event_bus");

class StateMachine {
  constructor() {
    this.handlers = {};
  }

  registerHandler(intent, fn) {
    this.handlers[intent] = fn;
  }

  async dispatch(intent, payload = {}) {
    const handler = this.handlers[intent];
    if (!handler) {
      //console.warn("[StateMachine] unknown intent:", intent);
      return;
    }

    const ctx = {
      stateStore,
      storage,
      eventBus,
      stateMachine: this,
    };

    try {
      await handler(payload, ctx);
    } catch (e) {
      //console.error("[StateMachine] handler error:", intent, e);
    }
  }

  getState() {
    return stateStore.getState();
  }
}

module.exports = new StateMachine();
