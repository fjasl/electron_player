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
const tabController = new TabController();

// 播放 UI 控制
const playUI = new PlayUIController();

// 列表 UI 控制
const listUI = new ListUIController();

// 维护：列表项 id -> 后端 playlist.index 的映射
let idToIndexMap = new Map();

// 音频管理器（对应 index.html 里的 <audio id="player_audio">）
const audioManager = new AudioManager("player_audio");

// 记录当前 audio 正在播放的那一首（用后端的 track.id）
let currentAudioTrackId = null;

//记录路径
let currentAudioPath = null;

const discoManager = new DiscoManager();

const mediaControl = new MediaControl();

const lyricManager = new LyricManager();

// ============== AudioManager → 后端 / UI ==============

// audioManager.callbacks.onPlayStateChange = (isPlaying) => {
//   console.log("[frontend] audio play state:", isPlaying);
//   playUI.setPlayState(isPlaying);
//   sendIntent("play_toggle", { is_playing: isPlaying });
// };

audioManager.callbacks.onProgress = (position, duration) => {
  playUI.setProgress(position, duration);
};

audioManager.callbacks.onEnded = () => {
  console.log("[frontend] audio ended → play_next");
  sendIntent("play_next", {});
};

// ============== 播放界面 → AudioManager / 后端意图 ==============

// 播放/暂停：只控制 <audio>，后端通过 audio 事件感知
playUI.callbacks.onReturn = () => {
  tabController.switchTab("list");
};

playUI.callbacks.onPlayToggle = () => {
  console.log("[frontend] 播放按钮切换：");
  // audioManager.setPlaying(isPlaying);
  sendIntent("play_toggle", {});
};

playUI.callbacks.onNext = () => {
  console.log("[frontend] 下一曲");
  sendIntent("play_next", {});
};

playUI.callbacks.onPrev = () => {
  console.log("[frontend] 上一曲");
  sendIntent("play_prev", {});
};

// 喜欢：前端只发一次“like”意图，具体次数累计在后端控制
playUI.callbacks.onLikeToggle = () => {
  console.log("[frontend] like了一次");
  sendIntent("like", {});
};

playUI.callbacks.onModeChange = (mode) => {
  console.log("[frontend] 播放模式："); // loop | one | shuffle
  sendIntent("set_play_mode", {});
};

playUI.callbacks.onSeek = (percent) => {
  console.log("[frontend] 跳转进度：", percent);
  // 1）先让 audio 跳转
  audioManager.seekToPercent(percent);
  // 2）立刻告诉后端（不用等 timeupdate）
  sendIntent("seek", { percent });
};

playUI.callbacks.onLyricJump = () => {
  console.log("[frontend] 跳转歌词界界面");
  tabController.switchTab("lyric");
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
    tabController.switchTab("play");
  } else {
    console.warn("[frontend] 无法找到该 item 对应的 playlist.index");
  }
};

// 新增歌曲（纯 UI 日志）
listUI.callbacks.onItemAdded = (item) => {
  console.log("[frontend] 添加列表项：", item.id, item.titleText);
};

//绑定歌词按钮
listUI.callbacks.onContactLyric= (item) => {
  console.log("[frontend] 绑定列表项：", item.id);
  const idx = idToIndexMap.get(item.id);
  if (typeof idx === "number") {
    sendIntent("bind_list_track", { index: idx });
  } else {
    console.warn("[frontend] 删除时找不到 index，对应 id:", idx);
  }
}
// 删除歌曲：转成 index 给后端
listUI.callbacks.onItemRemoved = (item) => {
  console.log("[frontend] 删除列表项：", item.id);
  const idx = idToIndexMap.get(item.id);
  if (typeof idx === "number") {
    sendIntent("del_list_track", { index: idx });
  } else {
    console.warn("[frontend] 删除时找不到 index，对应 id:", id);
  }
};

// 点击“选择文件” → open_files
listUI.callbacks.onFilePickClick = () => {
  console.log("[frontend] 点击选择文件按钮 → intent: open_files");
  sendIntent("open_files", {});
};
listUI.callbacks.onFindBtnClick = (item) => {
  console.log("[fontend]: 定位按钮");
  const fileName = titleFromPath(currentAudioPath);
  const targetItem = item.find((item) => item.titleText === fileName);
  listUI.currentId = targetItem.id;
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
  
  if(listUI.isSearching === true){
    const kw = listUI.searchBar.value;
    console.log("重建列表"+kw);
    listUI.applyFilter(kw);
  }

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
// ============== 系统媒体控件 ==============
mediaControl.callbacks.onPlay = () => {
  console.log("[frontend] 播放按钮切换：");
  // audioManager.setPlaying(isPlaying);
  sendIntent("play_toggle", {});
};
mediaControl.callbacks.onPause = () => {
  console.log("[frontend] 播放按钮切换：");
  // audioManager.setPlaying(isPlaying);
  sendIntent("play_toggle", {});
};
mediaControl.callbacks.onNext = () => {
  console.log("[frontend] 下一曲");
  sendIntent("play_next", {});
};
mediaControl.callbacks.onPrev = () => {
  console.log("[frontend] 上一曲");
  sendIntent("play_prev", {});
};
// 监听后端 EventBus 发来的事件
ipcRenderer.on("backend-event", (_event, { event: name, payload }) => {
  // console.log("[frontend] backend-event:", name, payload);

  // 播放列表变更
  if (name === "playlist_changed") {
    const playlist = payload?.playlist || [];
    rebuildListFromPlaylist(playlist);
    return;
  }

  // 当前曲目变更（切歌 / 启动恢复 / seek / like 之后的状态）
  if (name === "current_track_changed") {
    const current = payload?.current;
    if (!current) return;

    const title = current.title || "";
    const artist = current.artist || "";
    const position = current.position || 0;
    const duration = current.duration || 0;
    currentAudioPath = current.path || "";

    console.log(current);
    // mediaControl.updateMetadata(current);
    mediaControl.updateTitle(current.title);
    mediaControl.updateArtist(current.artist);

    // 更新播放界面歌曲信息 + 进度
    playUI.setSongInfo(title, artist);
    playUI.setProgress(position, duration);

    // 每次切到新歌，都重置“本次播放是否已经点过喜欢”
    //（真正的 likedCount 在后端的 state 中维护）
    playUI.setLiked(false);

    // 如果是“首切到这首歌”（或启动恢复的那首），并且 path 有效 → 让 Audio 播放
    if (current.id && current.path && current.id !== currentAudioTrackId) {
      console.log("[frontend] loadAndPlay:", current.path, "from", position);
      audioManager.load(current.path, position || 0);
      currentAudioTrackId = current.id;
      sendIntent("cover_request", {});
      console.log("[frontend] load:", current.path, "from", position);
    }

    // 高亮列表当前项
    highlightCurrentTrack(current);
    console.log("[曲目变化]:"+payload.lyric);
    lyricManager._rebuildLyriclist(payload?.lyric);

    return;
  }

  // 播放状态来自后端（主要是同步给 UI，真正驱动的是 <audio>）
  if (name === "play_state_changed") {
    const isPlaying = payload?.is_playing;
    // console.log("[event:play_state_changed] isPlaying =", isPlaying);
    playUI.setPlayState(isPlaying);
    audioManager.setPlaying(isPlaying);
    discoManager.toggleRotation(isPlaying);
    return;
  }

  // 播放模式改变（single_loop / shuffle → UI 的 one / shuffle）
  if (name === "play_mode_changed") {
    const backendMode = payload?.play_mode;
    playUI.setMode(backendMode);
    return;
  }

  if (name === "cover_reply") {
    discoManager.setCover(payload?.cover || "");
    mediaControl.updateArtwork(payload?.cover);
  }

  if(name ==="lyric_index_changed") {
    console.log("歌词进度改变"+payload.index);
    lyricManager.scrollToCurrentItem(payload?.index);
  }
});
