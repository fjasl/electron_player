// res/js/main.js

const { ipcRenderer } = require("electron");

// 发送意图到后端状态机
function sendIntent(intent, payload = {}) {
  ipcRenderer.send("frontend-intent", { intent, payload });
}

// 从路径里取文件名用于展示
function titleFromPath(p) {
  if (!p) return "未知标题";
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

// 播放 UI 控制
const playUI = new PlayUIController();

// 列表 UI 控制
const listUI = new ListUIController();

// 维护：列表项 id -> 后端 playlist.index 的映射
let idToIndexMap = new Map();

// ============== 播放界面 → 后端意图 ==============

playUI.callbacks.onPlayToggle = (isPlaying) => {
  console.log("[frontend] 播放状态切换：", isPlaying);
  sendIntent("play_toggle", { is_playing: isPlaying });
};

playUI.callbacks.onNext = () => {
  console.log("[frontend] 下一曲");
  sendIntent("play_next", {});
};

playUI.callbacks.onPrev = () => {
  console.log("[frontend] 上一曲");
  sendIntent("play_prev", {});
};

playUI.callbacks.onLikeToggle = () => {
  console.log("[frontend] like了一次");
  sendIntent("like", {  });
};

playUI.callbacks.onModeChange = (mode) => {
  console.log("[frontend] 播放模式：", mode); // loop | one | shuffle
  sendIntent("set_play_mode", { mode });
};

playUI.callbacks.onSeek = (percent) => {
  console.log("[frontend] 跳转进度：", percent);
  sendIntent("seek", { percent });
};

playUI.callbacks.onLyricJump = () => {
  console.log("[frontend] 跳转歌词界面（暂未实现）");
};

// ============== 列表界面 → 后端意图 ==============

// 单击：先只是 UI 选中（你以后可以加 select_list_track）
listUI.callbacks.onItemSelect = (item) => {
  console.log("[frontend] 选中列表项：", item.id, item.titleText);
};

// 双击：播放该列表项
listUI.callbacks.onItemPlay = (item) => {
  console.log("[frontend] 双击播放：", item.id, item.titleText);
  const idx = idToIndexMap.get(item.id);
  if (typeof idx === "number") {
    sendIntent("play_list_track", { index: idx });
  } else {
    console.warn("[frontend] 无法找到该 item 对应的 playlist.index");
  }
};

// 新增歌曲（纯 UI 日志）
listUI.callbacks.onItemAdded = (item) => {
  console.log("[frontend] 添加列表项：", item.id, item.titleText);
};


listUI.callbacks.onItemRemoved = (item) => {
  console.log("[frontend] 删除列表项：", item.id, item.titleText);
  const idx = idToIndexMap.get(item.id);
  if (typeof idx === "number") {
    sendIntent("del_list_track", { index: idx });
  } else {
    console.warn("[frontend] 删除时找不到 index，对应 id:", item.id);
  }
};

// 点击“选择文件夹 / 文件” → open_files
listUI.callbacks.onFilePickClick = () => {
  console.log("[frontend] 点击选择文件按钮 → intent: open_files");
  sendIntent("open_files", {});
};

// 搜索关键字变化（调试用）
listUI.callbacks.onFilterChange = (kw) => {
  console.log("[frontend] 当前搜索关键字：", kw);
};

// ============== 后端 → 前端：事件驱动 UI ==============

/**
 * 用后端发来的 playlist 重建列表 UI
 * playlist: [{ id, index, path }]
 */
function rebuildListFromPlaylist(playlist) {
  console.log("[frontend] rebuildListFromPlaylist, len =", playlist.length);

  // 1. 清空现有 DOM 列表项 & 内存数据
  listUI.items.forEach((it) => {
    if (it.el && it.el.parentNode) {
      it.el.parentNode.removeChild(it.el);
    }
  });
  listUI.items = [];
  listUI.currentId = null;
  listUI.nextId = 1;

  // 2. 重置映射
  idToIndexMap = new Map();

  // 3. 渲染新列表，并建立 id -> index 映射
  playlist.forEach((track) => {
    const titleText = titleFromPath(track.path);
    const item = listUI.addItem({ titleText });
    // item 是 { id, el, titleText }
    idToIndexMap.set(item.id, track.index);
  });
}

/** 根据 current_track 高亮列表里对应项 */
function highlightCurrentTrack(current) {
  if (!current) return;
  const playIndex = typeof current.index === "number" ? current.index : -1;
  if (playIndex < 0) return;

  let targetId = null;
  for (const [id, idx] of idToIndexMap.entries()) {
    if (idx === playIndex) {
      targetId = id;
      break;
    }
  }
  if (targetId) {
    listUI.setCurrentItem(targetId);
  }
}

// 监听后端 EventBus 发来的事件
ipcRenderer.on("backend-event", (_event, { event: name, payload }) => {
  console.log("[frontend] backend-event:", name, payload);

  if (name === "playlist_changed") {
    const playlist = payload?.playlist || [];
    rebuildListFromPlaylist(playlist);
    return;
  }

  if (name === "current_track_changed") {
    const current = payload?.current;
    if (!current) return;

    const title = current.title || titleFromPath(current.path);
    const artist = current.artist || "";
    const position = current.position || 0;
    const duration = current.duration || 0;

    // 更新播放界面歌曲信息 + 进度
    playUI.setSongInfo(title, artist);
    playUI.setProgress(position, duration);

    // 收藏状态

    playUI.setLiked(false);

    // 高亮列表当前项
    highlightCurrentTrack(current);
    return;
  }

  if (name === "play_state_changed") {
    const isPlaying = !!payload?.is_playing;
    playUI.setPlayState(isPlaying);
    return;
  }

  if (name === "play_mode_changed") {
    const backendMode = payload?.play_mode || "single_loop";
    // 简单映射：shuffle -> shuffle，其余先都视为单曲循环 one
    const uiMode = backendMode === "shuffle" ? "shuffle" : "one";
    playUI.setMode(uiMode);
    return;
  }
});
