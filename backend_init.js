// backend_init.js
const LrcParser = require("./handlers/lyric");
const { ipcMain } = require("electron");
const eventBus = require("./event_bus");
const stateMachine = require("./state_machine");
const stateStore = require("./units/state_store");
const storage = require("./units/storage");
const { registerPlaylistHandlers } = require("./handlers/playlist");
const { registerPlaybackHandlers } = require("./handlers/playback");
const PluginManager = require("./plugin_manger");

async function initBackend(win) {
  // 让 EventBus 知道往哪个窗口发事件
  eventBus.bindWindow(win);

  // 1. 载入本地完整状态
  const loadedState = storage.loadState();
  if (loadedState) {
    stateStore.hydrateFromStorage(loadedState);
    stateStore.setPlaying(false);
    stateStore.setLyricList(
      await LrcParser.loadAndParseLrcFile(
        stateStore.get("current_track.lyric_bind")
      )
    );
    stateStore.setCurrentLyricRow(0);
  } else {
  }

  // 2. 注册各类 intent -> handler
  registerPlaylistHandlers(stateMachine);
  registerPlaybackHandlers(stateMachine);

  pluginManager = new PluginManager();
  pluginManager.injectDeps({
    stateStore,
    eventBus,
    stateMachine,
  });
  pluginManager.registerUIRequestIntent();
  module.exports.pluginManager = pluginManager;

  // 3. 建立前端 → 后端：通用意图入口
  ipcMain.on("frontend-intent", (_event, msg) => {
    const { intent, payload } = msg || {};
    if (!intent) return;
    stateMachine.dispatch(intent, payload);
  });

  // ==========================================
  // 【新添加位置】：高频音频数据转发
  // ==========================================
  ipcMain.on("audio-data", (_event, buffer) => {
    // 通过 module.exports 访问是为了确保引用的是当前正在运行的实例
    const serverPlugin = pluginManager.getPlugin("ServerPlugin");

    // 只有当插件存在且有活跃连接时才执行广播
    if (serverPlugin && typeof serverPlugin.broadcastAudio === "function") {
      serverPlugin.broadcastAudio(buffer);
    }
  });

  win.webContents.on("did-finish-load", () => {
    const PLAYLIST = stateStore.get("playlist") || [];
    if (PLAYLIST.length > 0) {
      eventBus.emit("playlist_changed", { playlist: PLAYLIST });
    } else {
    }

    const CURRENT_TRACK = stateStore.get("current_track");
    if (CURRENT_TRACK && CURRENT_TRACK.index >= 0) {
      eventBus.emit("current_track_changed", {
        current: CURRENT_TRACK,
        lyric: stateStore.get("Lyric.LyricList"),
      });
    }
    const MODE = stateStore.get("play_mode");
    if ((stateStore && MODE === "single_loop") || "shuffle") {
      eventBus.emit("play_mode_changed", {
        play_mode: MODE,
      });
    }
    const VOLUME = stateStore.get("volume");
    if (stateStore && typeof VOLUME === "number") {
      eventBus.emit("volume_changed", {
        percent: VOLUME,
      });
    }
    eventBus.emit("log", { msg: "[Backend] 准备开始加载插件" });
    pluginManager.loadAll();
    eventBus.emit("log", { msg: "[Backend] 所有核心初始化完成，插件已加载" });
  });

  return stateStore;
}

module.exports = {
  initBackend,
  get pluginManager() {
    return pluginManager;
  },
};
