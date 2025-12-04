// state_store.js

class StateStore {
  constructor() {
    this.state = {
      // 播放列表：TrackModel = { id, index, path, likedCount }
      playlist: [],

      // 当前曲目（附带更多元数据）
      current_track: {
        id: null,
        index: -1,
        path: null,
        position: 0,
        duration: 0,
        title: null,
        artist: null,

        // ⭐ 新增：点击次数（持久）
        likedCount: 0,
      },

      play_mode: "single_loop",

      last_session: {
        id: null,
        path: null,
        position: 0,
        play_mode: "single_loop",
      },

      settings: {},
    };
  }

  // ========== 通用接口 ==========

  getState() { return this.state; }
  get(k) { return this.state[k]; }
  set(k, v) { this.state[k] = v; }
  patch(partial) { this.state = { ...this.state, ...partial }; }

  // ========== playlist ==========

  setPlaylist(list) {
    this.state.playlist = (list || []).map((t, i) => ({
      id: t.id,
      index: typeof t.index === "number" ? t.index : i,
      path: t.path,
      likedCount: typeof t.likedCount === "number" ? t.likedCount : 0, // ⭐
    }));
  }

  appendToPlaylist(tracks) {
    const base = this.state.playlist.length;
    const appended = (tracks || []).map((t, i) => ({
      id: t.id,
      index: base + i,
      path: t.path,
      likedCount: typeof t.likedCount === "number" ? t.likedCount : 0, // ⭐
    }));
    this.state.playlist = this.state.playlist.concat(appended);
  }

  findTrackByIndex(index) {
    return this.state.playlist.find((t) => t.index === index);
  }
  findTrackById(id) {
    return this.state.playlist.find((t) => t.id === id);
  }

  /** ⭐ likedCount + 1 */
  increaseLikedById(id) {
    const t = this.findTrackById(id);
    if (t) t.likedCount = (t.likedCount || 0) + 1;
    return t?.likedCount ?? 0;
  }

  // ========== current_track ==========

  setCurrentTrackFromTrack(track) {
    if (!track) {
      this.state.current_track = {
        id: null, index: -1, path: null,
        position: 0, duration: 0,
        title: null, artist: null,
        likedCount: 0,
      };
      return;
    }

    this.state.current_track = {
      id: track.id,
      index: track.index,
      path: track.path,
      position: track.position || 0,
      duration: track.duration || 0,
      title: track.title || null,
      artist: track.artist || null,

      likedCount: typeof track.likedCount === "number" ? track.likedCount : 0,
    };
  }

  updateCurrentPosition(pos) {
    this.state.current_track.position = pos;
  }

  setPlayMode(mode) {
    if (mode === "single_loop" || mode === "shuffle")
      this.state.play_mode = mode;
  }

  /** ⭐ 当前曲目的 likedCount +1（同时更新playlist） */
  addCurrentTrackLikedOnce() {
    const ct = this.state.current_track;
    if (!ct.id) return;

    const newCnt = this.increaseLikedById(ct.id);
    ct.likedCount = newCnt;
  }

  // ========== last_session ==========

  snapshotLastSession() {
    const ct = this.state.current_track;
    this.state.last_session = {
      id: ct.id,
      path: ct.path,
      position: ct.position,
      play_mode: this.state.play_mode,
    };
  }

  // ========== hydrate ==========

  hydrateFromStorage(loaded) {
    if (!loaded || typeof loaded !== "object") return;

    // playlist
    if (Array.isArray(loaded.playlist))
      this.setPlaylist(loaded.playlist);

    // current_track
    if (loaded.current_track) {
      const ct = loaded.current_track;
      this.state.current_track = {
        id: ct.id ?? null,
        index: ct.index ?? -1,
        path: ct.path ?? null,
        position: ct.position ?? 0,
        duration: ct.duration ?? 0,
        title: ct.title ?? null,
        artist: ct.artist ?? null,
        likedCount: ct.likedCount ?? 0,   // ⭐
      };
    }

    // play_mode
    if (loaded.play_mode) this.setPlayMode(loaded.play_mode);

    // last_session
    if (loaded.last_session)
      this.state.last_session = loaded.last_session;

    // settings
    if (loaded.settings) this.state.settings = loaded.settings;
  }
}

module.exports = new StateStore();
