// storage.js
const fs = require("fs");
const path = require("path");

// 整个应用状态存这里
const STATE_FILE = path.join(process.cwd(), "app_state.json");

class Storage {
  /**
   * 读取完整应用状态
   * @returns {Object|null}
   */
  loadState() {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        return data;
      }
      return null;
    } catch (e) {
      //console.warn("[Storage] loadState error:", e.message);
      return null;
    }
  }

  /**
   * 保存完整应用状态
   * @param {Object} state
   */
  saveState(state) {
    try {
      const json = JSON.stringify(state, null, 2);
      fs.writeFileSync(STATE_FILE, json, "utf-8");
    } catch (e) {
      //console.warn("[Storage] saveState error:", e.message);
    }
  }
}

module.exports = new Storage();
