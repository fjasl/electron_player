// res/js/audio_manager.js

class AudioManager {
  constructor(audioElementOrId) {
    this.audio =
      typeof audioElementOrId === "string"
        ? document.getElementById(audioElementOrId)
        : audioElementOrId;

    if (!this.audio) {
      throw new Error("[AudioManager] audio element not found");
    }

    this.callbacks = {
      onPlayStateChange: null,
      onProgress: null,
      onEnded: null,
    };
    this.sleeptime = 100;
    this.lastTime = 0;
    this._lastProgressSentAt = 0;
    this._bindEvents();
  }

  _bindEvents() {
    this.audio.addEventListener("play", () => {
      this.callbacks.onPlayStateChange?.(true);
    });

    this.audio.addEventListener("pause", () => {
      this.callbacks.onPlayStateChange?.(false);
    });

    this.audio.addEventListener("timeupdate", () => {
      const position = this.audio.currentTime || 0;
      const duration = this.audio.duration || 0;
      sendIntent("position_report", { position });
      this.callbacks.onProgress?.(position, duration);
    });

    this.audio.addEventListener("ended", () => {
      this.callbacks.onEnded?.();
    });
  }

  _toFileUrl(filePath) {
    if (!filePath) return "";
    let p = filePath.replace(/\\/g, "/");
    if (!p.startsWith("/")) {
      p = "/" + p;
    }
    return "file://" + encodeURI(p);
  }

  // ======================
  // 对外控制 API
  // ======================

  /**
   * 只载入一个本地文件，不自动播放
   */
  load(filePath, startPosition = 0) {
    const url = this._toFileUrl(filePath);
    if (!url) return;

    this.audio.src = url;
    try {
      this.audio.currentTime = startPosition || 0;
    } catch (e) {
      console.warn("[AudioManager] set currentTime failed:", e.message);
    }
  }

  /**
   * 载入并播放一个本地文件（老行为，方便你以后需要时调用）
   */
  loadAndPlay(filePath, startPosition = 0) {
    this.load(filePath, startPosition);
    this.audio
      .play()
      .catch((err) => console.warn("[AudioManager] play error:", err.message));
  }

  setPlaying(isPlaying) {
    if (isPlaying) {
      this.audio
        .play()
        .catch((err) =>
          console.warn("[AudioManager] play error:", err.message)
        );
    } else {
      this.audio.pause();
    }
  }

  seekToPercent(percent) {
    const duration = this.audio.duration || 0;
    if (duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, percent));
    this.audio.currentTime = clamped * duration;
  }

  getCurrent() {
    return {
      position: this.audio.currentTime || 0,
      duration: this.audio.duration || 0,
      paused: this.audio.paused,
    };
  }

  setVolume(volume) {
    // 确保音量在 0 和 1 之间
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  reportProgress(is_playing) {
    if (is_playing) {
      requestAnimationFrame(() => this.reportProgress(is_playing));
    }
    const timestamp = Date.now();
    const elapsed = timestamp - this.lastTime;
    if (elapsed >= this.sleeptime) {
      this.lastTime = timestamp;
      const position = this.audio.currentTime || 0;
      sendIntent("position_report", { position });
    }
  }
}

window.AudioManager = AudioManager;
