// state_store.js

class StateStore {
  constructor() {
    this.state = {
      // 播放列表：TrackModel = { index, path, likedCount ,lyric_bind}
      playlist: [],
      Lyric: {
        LyricList: [],
        currentLyricRow: 0,
      },
      // 当前曲目（附带更多元数据）
      current_track: {
        index: -1,
        path: null,
        position: 0,
        duration: 0,
        title: null,
        artist: null,

        // ⭐ 新增：点击次数（持久）
        likedCount: 0,
        lyric_bind: "",
        cover: "",
      },
      is_playing: false,
      play_mode: "single_loop",
      volume: 0,

      last_session: {
        path: null,
        position: 0,
        play_mode: "single_loop",
        lyric_bind: null,
      },

      settings: {},
    };
  }

  // ========== 通用接口 ==========

  getState() {
    return this.state;
  }
  get(path, fallback) {
    if (path == null) return fallback;

    // 1) 允许传数组路径：get(["Lyric","LyricList",0])
    const parts = Array.isArray(path)
      ? path
      : String(path)
          // 把 [0] 变成 .0，把 ["xx"] 也支持一下
          .replace(/\[(\d+)\]/g, ".$1")
          .replace(/\[["']([^"']+)["']\]/g, ".$1")
          .split(".")
          .filter(Boolean);

    let cur = this.state;

    for (const key of parts) {
      if (cur == null) return fallback;

      // 数字 key -> 数组下标
      const k = String(+key) === key ? Number(key) : key;
      cur = cur[k];
    }

    return cur ?? fallback;
  }

  set(path, value) {
    if (path == null) return;

    // 和 get 一样处理路径
    const parts = Array.isArray(path)
      ? path
      : String(path)
          .replace(/\[(\d+)\]/g, ".$1")
          .replace(/\[["']([^"']+)["']\]/g, ".$1")
          .split(".")
          .filter(Boolean);

    if (parts.length === 0) return;

    // 如果只有一级，直接赋值（保持原有行为兼容）
    if (parts.length === 1) {
      this.state[parts[0]] = value;
      return;
    }

    // 多级：从根开始遍历，创建中间层
    let cur = this.state;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const numKey = Number(key);

      // 判断下一个应该是什么类型
      const isArrayIndex = String(numKey) === key && numKey >= 0;

      if (isArrayIndex) {
        // 期望是数组
        if (!Array.isArray(cur[key])) {
          cur[key] = []; // 自动创建数组
        }
      } else {
        // 期望是对象
        if (cur[key] == null || typeof cur[key] !== "object") {
          cur[key] = {}; // 自动创建对象
        }
      }

      cur = cur[key];
    }

    // 最后一步：设置最终值
    const lastKey = parts[parts.length - 1];
    const lastNumKey = Number(lastKey);

    if (String(lastNumKey) === lastKey && lastNumKey >= 0) {
      // 如果最后一个是数字索引，且当前是数组，就直接设
      if (Array.isArray(cur)) {
        cur[lastNumKey] = value;
      } else {
        // 如果不是数组但想设索引，就转成数组（防御性）
        cur[lastKey] = value;
      }
    } else {
      cur[lastKey] = value;
    }
  }
  patch(partial) {
    this.state = { ...this.state, ...partial };
  }

  // ========== playlist ==========

  setPlaylist(list) {
    this.state.playlist = (list || []).map((t, i) => ({
      index: typeof t.index === "number" ? t.index : i,
      path: t.path,
      likedCount: typeof t.likedCount === "number" ? t.likedCount : 0, // ⭐
      lyric_bind: typeof t.lyric_bind === "string" ? t.lyric_bind : "",
    }));
  }

  appendToPlaylist(tracks) {
    const base = this.state.playlist.length;
    const appended = (tracks || []).map((t, i) => ({
      index: base + i,
      path: t.path,
      likedCount: typeof t.likedCount === "number" ? t.likedCount : 0, // ⭐
      lyric_bind: typeof t.lyric_bind === "string" ? t.lyric_bind : "",
    }));
    this.state.playlist = this.state.playlist.concat(appended);
  }

  findTrackByIndex(index) {
    return this.state.playlist.find((t) => t.index === index);
  }

  increaseLikedByIndex(index) {
    const t = this.findTrackByIndex(index);
    if (t) t.likedCount = (t.likedCount || 0) + 1;
    return t?.likedCount ?? 0;
  }

  // ========== current_track ==========

  setCurrentTrackFromTrack(track) {
    if (!track) {
      this.state.current_track = {
        index: -1,
        path: null,
        position: 0,
        duration: 0,
        title: null,
        artist: null,
        likedCount: 0,
        lyric_bind: "",
        cover: "",
      };
      return;
    }

    this.state.current_track = {
      index: track.index,
      path: track.path,
      position: track.position || 0,
      duration: track.duration || 0,
      title: track.title || null,
      artist: track.artist || null,
      likedCount: typeof track.likedCount === "number" ? track.likedCount : 0,
      lyric_bind: typeof track.lyric_bind === "string" ? track.lyric_bind : "",
      cover: typeof track.cover === "string" ? track.cover : "",
    };
  }

  updateCurrentPosition(pos) {
    this.state.current_track.position = pos;
  }

  setPlayMode(mode) {
    if (mode === "single_loop" || mode === "shuffle")
      this.state.play_mode = mode;
  }
  setPlaying(isPlaying) {
    if (typeof isPlaying === "boolean") {
      this.state.is_playing = isPlaying;
    }
  }

  /** ⭐ 当前曲目的 likedCount +1（同时更新playlist） */
  addCurrentTrackLikedOnce() {
    const ct = this.state.current_track;
    if (typeof ct.index !== "number" || ct.index < 0) return;

    const newCnt = this.increaseLikedByIndex(ct.index);
    ct.likedCount = newCnt;
  }

  // ========== last_session ==========

  snapshotLastSession() {
    const ct = this.state.current_track;
    this.state.last_session = {
      path: ct.path,
      position: ct.position,
      play_mode: this.state.play_mode,
      lyric_bind: ct.lyric_bind,
    };
  }
  // ========== Lyric ==========

  // 读取整个 Lyric 对象（不建议外部直接改返回对象）
  getLyricState() {
    return this.state.Lyric;
  }

  // 读取歌词数组
  getLyricList() {
    return this.state.Lyric.LyricList || [];
  }

  // 覆盖写入歌词数组（会做基本兜底 + 重置行指针）
  setLyricList(list) {
    this.state.Lyric.LyricList = Array.isArray(list) ? list : [];
    // 防止旧行号越界
    this.state.Lyric.currentLyricRow = 0;
  }

  // 追加歌词（单条或多条）
  appendLyric(itemOrItems) {
    const cur = this.getLyricList();
    if (Array.isArray(itemOrItems)) {
      this.state.Lyric.LyricList = cur.concat(itemOrItems);
    } else if (itemOrItems != null) {
      cur.push(itemOrItems);
      this.state.Lyric.LyricList = cur;
    }
  }

  // 清空歌词（并重置行指针）
  clearLyric() {
    this.state.Lyric.LyricList = [];
    this.state.Lyric.currentLyricRow = 0;
  }

  // 读取当前行
  getCurrentLyricRow() {
    return this.state.Lyric.currentLyricRow || 0;
  }

  // 设置当前行（自动 clamp 到合法范围）
  setCurrentLyricRow(row) {
    const listLen = this.getLyricList().length;
    let r = typeof row === "number" ? row : 0;
    if (r < 0) r = 0;
    if (listLen > 0 && r >= listLen) r = listLen - 1;
    this.state.Lyric.currentLyricRow = r;
  }

  // 基于 delta 移动行（例如 +1 / -1）
  moveCurrentLyricRow(delta) {
    const cur = this.getCurrentLyricRow();
    const d = typeof delta === "number" ? delta : 0;
    this.setCurrentLyricRow(cur + d);
  }

  //========== volume =========
  setVolume(volume) {
    if (typeof volume === "number" && Number.isFinite(volume)) {
      // clamp 到 0~1
      const v = Math.max(0, Math.min(1, volume));
      this.state.volume = v;
    }
  }
  //================setting==============
  appendToPlaylist(tracks) {
    const base = this.state.playlist.length;
    const appended = (tracks || []).map((t, i) => ({
      index: base + i,
      path: t.path,
      likedCount: typeof t.likedCount === "number" ? t.likedCount : 0, // ⭐
      lyric_bind: typeof t.lyric_bind === "string" ? t.lyric_bind : "",
    }));
    this.state.playlist = this.state.playlist.concat(appended);
  }
  /**
   * 追加一个新的 plugin（如果同名已存在，则不追加）
   * @param {Object} plugin - 必须包含 name 属性
   * @returns {boolean} 是否成功追加
   */
  appendPlugin(pluginName) {
    if (typeof pluginName !== "string") {
      return false;
    }

    // 初始化 plugins 数组（如果还不存在）
    if (!Array.isArray(this.state.settings.plugins)) {
      this.state.settings.plugins = [];
    }

    // 检查是否已存在同名 plugin
    const exists = this.state.settings.plugins.some(
      (p) => p.name === pluginName
    );
    if (exists) {
      return false;
    }
    const plugin = {
      name: pluginName,
    };
    // 深拷贝后追加
    this.state.settings.plugins.push(JSON.parse(JSON.stringify(plugin)));
    return true;
  }
  /**
   * 根据插件的 name 字段，进行整项添加或覆写
   * @param {Object} plugin - 完整的插件对象，必须包含 name 属性
   * @returns {boolean} 是否成功（true 表示添加或更新成功）
   */
  upsertPlugin(plugin) {
    if (
      !plugin ||
      typeof plugin !== "object" ||
      typeof plugin.name !== "string" ||
      !plugin.name
    ) {
      return false;
    }

    // 确保 plugins 数组存在
    if (!Array.isArray(this.state.settings.plugins)) {
      this.state.settings.plugins = [];
    }

    // 查找是否已存在同名插件
    const index = this.state.settings.plugins.findIndex(
      (p) => p.name === plugin.name
    );

    // 深拷贝插件对象（防止外部修改影响内部状态）
    const newPlugin = JSON.parse(JSON.stringify(plugin));

    if (index >= 0) {
      // 已存在 → 整项覆写
      this.state.settings.plugins[index] = newPlugin;
    } else {
      // 不存在 → 追加
      this.state.settings.plugins.push(newPlugin);
    }

    return true;
  }
  /**
   * 根据插件 name 获取插件对象
   * @param {string} pluginName - 插件名称
   * @returns {Object|null} 返回插件对象的深拷贝，如果不存在返回 null
   */
  getPluginByName(pluginName) {
    if (typeof pluginName !== "string" || !pluginName) {
      return null;
    }

    // 确保 plugins 存在
    if (!Array.isArray(this.state.settings.plugins)) {
      return null;
    }

    // 查找匹配的插件
    const plugin = this.state.settings.plugins.find(
      (p) => p.name === pluginName
    );

    // 如果找到，返回深拷贝；否则返回 null
    return plugin ? JSON.parse(JSON.stringify(plugin)) : null;
  }
  // ========== hydrate ==========

  hydrateFromStorage(loaded) {
    if (!loaded || typeof loaded !== "object") return;

    // playlist
    if (Array.isArray(loaded.playlist)) this.setPlaylist(loaded.playlist);

    // current_track
    if (loaded.current_track) {
      const ct = loaded.current_track;
      this.state.current_track = {
        index: ct.index ?? -1,
        path: ct.path ?? null,
        position: ct.position ?? 0,
        duration: ct.duration ?? 0,
        title: ct.title ?? null,
        artist: ct.artist ?? null,
        likedCount: ct.likedCount ?? 0,
        lyric_bind: typeof ct.lyric_bind === "string" ? ct.lyric_bind : "",
        cover: typeof ct.cover === "string" ? ct.cover : "",
      };
    }
    if (loaded.is_playing) this.setPlaying(loaded.is_playing);

    // play_mode
    if (loaded.play_mode) this.setPlayMode(loaded.play_mode);

    // last_session
    if (loaded.last_session) this.state.last_session = loaded.last_session;

    // settings
    if (typeof loaded.settings === "object") this.state.settings = loaded.settings;

    if (typeof loaded.volume === "number") this.setVolume(loaded.volume);
  }
}

module.exports = new StateStore();
