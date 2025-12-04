// backend_init.js
const { ipcMain } = require("electron");
const eventBus = require("./event_bus");
const stateMachine = require("./state_machine");
const stateStore = require("./state_store");
const storage = require("./storage");
const { registerPlaylistHandlers } = require("./handlers/playlist");
const { registerPlaybackHandlers } = require("./handlers/playback");

function initBackend(win) {
  // 让 EventBus 知道往哪个窗口发事件
  eventBus.bindWindow(win);

  // 1. 载入本地完整状态
  const loadedState = storage.loadState();
  if (loadedState) {
    console.log("[BackendInit] loaded app_state.json");
    stateStore.hydrateFromStorage(loadedState);
  } else {
    console.log("[BackendInit] no existing state file, using defaults");
  }

  // 2. 注册各类 intent -> handler
  registerPlaylistHandlers(stateMachine);
  registerPlaybackHandlers(stateMachine);

  // 3. 建立前端 → 后端：通用意图入口
  ipcMain.on("frontend-intent", (_event, msg) => {
    const { intent, payload } = msg || {};
    console.log("[IPC] frontend-intent:", intent, payload);
    if (!intent) return;
    stateMachine.dispatch(intent, payload);
  });

  // 4. 等渲染进程加载完成后，再把当前状态同步给前端
  win.webContents.on("did-finish-load", () => {
    console.log("[BackendInit] did-finish-load, sync initial state to renderer");

    // 4.1 playlist 自动加载
    const playlistState = stateStore.get("playlist") || [];
    if (playlistState.length > 0) {
      console.log(
        "[BackendInit] emit playlist_changed on startup, len =",
        playlistState.length
      );
      eventBus.emit("playlist_changed", { playlist: playlistState });
    } else {
      console.log("[BackendInit] playlist is empty on startup");
    }

    // 4.2 如果已经有 current_track，也同步给前端
    const ct = stateStore.get("current_track");
    if (ct && ct.id) {
      console.log("[BackendInit] emit current_track_changed on startup");
      eventBus.emit("current_track_changed", { current: ct });
    }
  });
}

module.exports = {
  initBackend,
};
