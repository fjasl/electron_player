// handlers/playlist.js

const { dialog } = require("electron");
const { extractTracksMetadata } = require("../units/metadata");


/**
 * intent: open_files
 * payload: {}
 */
async function handleOpenFiles(_payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  // console.log(stateStore);
  const ret = await dialog.showOpenDialog({
    title: "选择音乐文件",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Audio",
        extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg", "ape", "wma"],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (ret.canceled || !ret.filePaths || ret.filePaths.length === 0) {
    // console.log("[open_files] user canceled");
    return;
  }

  // 原始选择
  const filePaths = ret.filePaths;
  // console.log("[open_files] selected:", filePaths);

  // 1) 同一次选择里去重（避免用户在对话框里点了重复的）
  const seenInDialog = new Set();
  const uniqueInDialog = [];
  for (const p of filePaths) {
    if (!seenInDialog.has(p)) {
      seenInDialog.add(p);
      uniqueInDialog.push(p);
    }
  }

  // 2) 和已有 playlist 去重（按 path）
  const beforeList = stateStore.get("playlist") || [];
  const existingPaths = new Set(beforeList.map((t) => t.path));

  const freshPaths = uniqueInDialog.filter((p) => !existingPaths.has(p));

  if (freshPaths.length === 0) {
    // console.log("[open_files] all selected files already in playlist, nothing to add");
    return;
  }

  // console.log("[open_files] after dedupe, new files:",freshPaths.length,freshPaths);

  // 3) 提取真实元数据（只对真正要新增的文件做）
  const metaList = await extractTracksMetadata(freshPaths);

  // 4) 构造只包含 id / path 的 track，交给 stateStore 维护 index
  const newTracks = metaList.map((meta, i) => ({
    path: meta.path,
  }));

  // 追加到 playlist 尾部
  stateStore.appendToPlaylist(newTracks);

  // 5) 如果此前列表为空，把“新增列表中的第一个”作为 current_track，带元数据
  const playlist = stateStore.get("playlist") || [];
  if (beforeList.length === 0 && playlist.length > 0 && metaList.length > 0) {
    const firstTrack = playlist[0];
    const firstMeta = metaList[0];

    stateStore.setCurrentTrackFromTrack({
      index: firstTrack.index,
      path: firstTrack.path,
      title: firstMeta.title,
      artist: firstMeta.artist,
      duration: firstMeta.duration,
    });
  }

  // 6) 持久化整个状态表
  storage.saveState(stateStore.getState());

  // 7) 广播 playlist_changed（payload 中只带 playlist）
  eventBus.emit("playlist_changed", { playlist });

  // console.log("[open_files] playlist length:", playlist.length);
}

/**
 * intent: del_list_track
 * payload: { index: number }
 */
async function handleDelListTrack(payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  const index = typeof payload?.index === "number" ? payload.index : -1;

  if (index < 0) {
    // console.warn("[del_list_track] invalid index:", payload);
    return;
  }

  let list = stateStore.get("playlist") || [];
  if (list.length === 0) return;

  const pos = list.findIndex((t) => t.index === index);
  if (pos === -1) {
    // console.warn("[del_list_track] index not found in playlist:", index);
    return;
  }

  const removed = list.splice(pos, 1)[0];
  // console.log("[del_list_track] removed:", removed);

  // 重新归一化 index => 0..n-1
  list.forEach((t, i) => {
    t.index = i;
  });
  stateStore.setPlaylist(list);

  // 处理 current_track
  const ct = stateStore.get("current_track");
  if (ct && typeof ct.index === "number" && ct.index >= 0) {
    if (ct.index === index) {
      // 删除的是当前播放曲目
      if (list.length > 0) {
        const fallbackIndex = Math.min(index, list.length - 1);
        const fallback = list[fallbackIndex];
        stateStore.setCurrentTrackFromTrack({
          index: fallback.index,
          path: fallback.path,
          // 这里不重新解析元数据，先清空 meta
          title: null,
          artist: null,
          duration: 0,
          likedCount: 0,
          lyric_bind: null,
          cover: "",
        });
        stateStore.clearLyric();
        eventBus.emit("current_track_changed", {
                current: stateStore.get("current_track"),
                lyric: stateStore.get("Lyric.LyricList"),
              });

      } else {
        // 列表空了
        stateStore.setCurrentTrackFromTrack(null);
      }
    } else if (ct.index > index) {
      // 当前曲目的 index 需要左移一位
      const newIndex = ct.index - 1;
      const newTrack = list.find((t) => t.index === newIndex);
      if (newTrack) {
        stateStore.setCurrentTrackFromTrack({
          index: newTrack.index,
          path: newTrack.path,
          title: ct.title,
          artist: ct.artist,
          duration: ct.duration,
          likedCount: ct.likedCount,
          lyric_bind: ct.lyric_bind,
          cover: ct.cover,
        });
      }
    }
  }

  // 保存 & 广播
  storage.saveState(stateStore.getState());
  eventBus.emit("playlist_changed", { playlist: stateStore.get("playlist") });
}

async function handleBindLyric(payload, ctx) {
  const { stateStore, storage, eventBus } = ctx;
  const index = typeof payload?.index === "number" ? payload.index : -1;

  const ret = await dialog.showOpenDialog({
    title: "选择歌词文件",
    properties: ["openFile"],
    filters: [
      {
        name: "txt",
        extensions: ["lrc"],
      },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (ret.canceled || !ret.filePaths || ret.filePaths.length === 0) {
    // console.log("[open_files] user canceled");
    return;
  }

  const filePath = ret.filePaths[0];
  // console.log("[open_files] selected:", filePath);

  if (index < 0) {
    // console.warn("[bind_list_track] invalid index:", payload);
    return;
  }

  let list = stateStore.get("playlist") || [];
  if (list.length === 0) return;

  const pos = list.findIndex((t) => t.index === index);
  if (pos === -1) {
    // console.warn("[bind_list_track] index not found in playlist:", index);
    return;
  }
  // console.warn("[bind_list_track] pos:" + pos);
  list[pos].lyric_bind = filePath;
  // console.warn("[bind_list_track] open file:" + list);

  stateStore.setPlaylist(list);
  storage.saveState(stateStore.getState());
}

function registerPlaylistHandlers(stateMachine) {
  stateMachine.registerHandler("open_files", handleOpenFiles);
  stateMachine.registerHandler("del_list_track", handleDelListTrack);
  stateMachine.registerHandler("bind_list_track", handleBindLyric);
}

module.exports = {
  registerPlaylistHandlers,
};
