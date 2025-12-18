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

    this._initWebAudio();
    this._bindEvents();
  }
  _initWebAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContext();
    this._source = this._ctx.createMediaElementSource(this.audio);

    // 创建 AnalyserNode 用于获取时域数据（音频流）
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 2048; // 可根据需要调整
    this._analyser.smoothingTimeConstant = 0.7;
    this._source.connect(this._analyser);
    this._analyser.connect(this._ctx.destination);

    // Buffer 用来保存获取的时域/频域数据
    this._buffer = new Uint8Array(this._analyser.frequencyBinCount);
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
  unload() {
    // 1) 停止播放
    try {
      this.audio.pause();
    } catch {}

    // 2) 中止加载 + 清空资源
    try {
      this.audio.removeAttribute("src");
    } catch {}
    this.audio.src = ""; // 或者 "about:blank" / "data:,"

    // 3) 关键：触发浏览器重置媒体元素（会 abort 当前加载/解码）
    try {
      this.audio.load();
    } catch {}

    // 4) 重置播放头（可选）
    try {
      this.audio.currentTime = 0;
    } catch {}
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

  startAudioDataProcessing() {
    const processData = () => {
      this._analyser.getByteFrequencyData(this._buffer);

      // 只取前几个频段（你可以调整，这里以 128 为例）
      const data = this._buffer.slice(0, 128);

      // 向后端发送音频数据，转换成二进制格式以减少开销
      ipcRenderer.send("audio-data", { data }); // 将 buffer 转移给 main

      requestAnimationFrame(processData); // 继续处理下一个帧
    };

    requestAnimationFrame(processData); // 启动
  }
}

window.AudioManager = AudioManager;
