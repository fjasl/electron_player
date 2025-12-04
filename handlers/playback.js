// handlers/playback.js
const path = require("path");
const { extractTracksMetadata } = require("../metadata");

/** UI 的模式到后端模式映射 */
function mapUiModeToPlayMode(mode) {
  if (mode === "shuffle") return "shuffle";
  // 目前后端只区分 single_loop / shuffle
  return "single_loop";
}

/** 根据播放模式和方向，计算下一首的 index */
function pickNextIndex(playMode, playlist, currentIndex, direction) {
  const len = playlist.length;
  if (len === 0) return -1;

  // 当前 index 不合法时，默认到第一首
  if (typeof currentIndex !== "number" || currentIndex < 0) {
    return 0;
  }

  if (playMode === "shuffle") {
    if (len === 1) return currentIndex;
    // 随机挑一个 != currentIndex
    let idx = currentIndex;
    for (let i = 0; i < 5; i++) {
      const r = Math.floor(Math.random() * len);
      if (r !== currentIndex) {
        idx = r;
        break;
      }
    }
    return idx;
  }

  // 默认：顺序循环
  if (direction > 0) {
    return (currentIndex + 1) % len;
  } else if (direction < 0) {
    return (currentIndex - 1 + len) % len;
  }
  return currentIndex;
}

/** 切换到指定 index 的曲目，负责填充元数据 + 更新 state + 广播事件 */
async function switchToIndex(index, ctx) {
  const { stateStore, storage, eventBus } = ctx;

  const track = stateStore.findTrackByIndex(index);
  if (!track) {
    console.warn("[playback] switchToIndex: track not found:", index);
    return;
  }

  // 真实元数据
  let title = path.basename(track.path);
  let artist = null;
  let duration = 0;

  try {
    const metas = await extractTracksMetadata([track.path]);
    const meta = metas[0];
    if (meta) {
      title = meta.title || title;
      artist = meta.artist || null;
      duration = typeof meta.duration === "number" ? meta.duration : 0;
    }
  } catch (e) {
    console.warn("[playback] metadata failed:", track.path, e.message);
  }

  const currentLiked = stateStore.get("settings")?.likedTrackIds?.includes(track.id);

  stateStore.setCurrentTrackFromTrack({
    id: track.id,
    index: track.index,
    path: track.path,
    title,
    artist,
    duration,
    liked: !!currentLiked,
  });

  // 切歌后默认从头开始播
  stateStore.updateCurrentPosition(0);
  stateStore.snapshotLastSession();
  storage.saveState(stateStore.getState());

  eventBus.emit("current_track_changed", {
    current: stateStore.get("current_track"),
  });
}

/** 双击列表播放 / 选择列表某首歌 */
async function handlePlayListTrack(payload, ctx) {
  const { index } = payload || {};
  if (typeof index !== "number" || index < 0) {
    console.warn("[play_list_track] invalid index:", index);
    return;
  }
  await switchToIndex(index, ctx);
}

/** 下一首 */
async function handlePlayNext(_payload, ctx) {
  const { stateStore } = ctx;
  const playlist = stateStore.get("playlist") || [];
  if (playlist.length === 0) return;

  const ct = stateStore.get("current_track") || {};
  const currentIndex = typeof ct.index === "number" ? ct.index : -1;
  const playMode = stateStore.get("play_mode") || "single_loop";

  const nextIndex = pickNextIndex(playMode, playlist, currentIndex, +1);
  if (nextIndex === -1) return;

  await switchToIndex(nextIndex, ctx);
}

/** 上一首 */
async function handlePlayPrev(_payload, ctx) {
  const { stateStore } = ctx;
  const playlist = stateStore.get("playlist") || [];
  if (playlist.length === 0) return;

  const ct = stateStore.get("current_track") || {};
  const currentIndex = typeof ct.index === "number" ? ct.index : -1;
  const playMode = stateStore.get("play_mode") || "single_loop";

  const prevIndex = pickNextIndex(playMode, playlist, currentIndex, -1);
  if (prevIndex === -1) return;

  await switchToIndex(prevIndex, ctx);
}

/** 播放/暂停 */
async function handlePlayToggle(payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  const isPlaying = !!(payload && payload.is_playing);

  stateStore.setPlaying(isPlaying);
  stateStore.snapshotLastSession();
  storage.saveState(stateStore.getState());

  eventBus.emit("play_state_changed", {
    is_playing: stateStore.get("is_playing"),
  });
}

/** 设置播放模式（来自 UI 的 loop/one/shuffle） */
async function handleSetPlayMode(payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  const uiMode = payload?.mode;
  if (!uiMode) return;

  const backendMode = mapUiModeToPlayMode(uiMode);
  stateStore.setPlayMode(backendMode);
  stateStore.snapshotLastSession();
  storage.saveState(stateStore.getState());

  eventBus.emit("play_mode_changed", {
    play_mode: backendMode,
  });
}

/** 跳转进度（percent: 0~1） */
async function handleSeek(payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  const percent = payload?.percent;
  if (typeof percent !== "number") return;

  const ct = stateStore.get("current_track");
  const duration = ct.duration || 0;
  let newPos = 0;
  if (duration > 0) {
    newPos = Math.max(0, Math.min(duration, percent * duration));
  }

  stateStore.updateCurrentPosition(newPos);
  stateStore.snapshotLastSession();
  storage.saveState(stateStore.getState());

  // 仍然复用 current_track_changed，把 position 带出去
  eventBus.emit("current_track_changed", {
    current: stateStore.get("current_track"),
  });
}

/** 收藏/取消收藏 当前曲目 */
async function handleLike(_payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;

  // ⭐ 当前曲目 likedCount += 1
  stateStore.addCurrentTrackLikedOnce();

  // 保存状态
  stateStore.snapshotLastSession();
  storage.saveState(stateStore.getState());

  // 发事件，让前端更新 UI
  eventBus.emit("track_being_liked", {
    current: stateStore.get("current_track"),
  });

  console.log("[like] 当前曲目 likedCount:", stateStore.get("current_track").likedCount);
}


/** 对外：注册所有播放相关的 intent */
function registerPlaybackHandlers(stateMachine) {
  stateMachine.registerHandler("play_list_track", handlePlayListTrack);
  stateMachine.registerHandler("play_next", handlePlayNext);
  stateMachine.registerHandler("play_prev", handlePlayPrev);
  stateMachine.registerHandler("play_toggle", handlePlayToggle);
  stateMachine.registerHandler("set_play_mode", handleSetPlayMode);
  stateMachine.registerHandler("seek", handleSeek);
  stateMachine.registerHandler("like", handleLike);
}

module.exports = {
  registerPlaybackHandlers,
};
