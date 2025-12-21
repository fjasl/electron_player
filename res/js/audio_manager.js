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
    this.startAudioDataProcessing();
  }
  _initWebAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContext();
    this._source = this._ctx.createMediaElementSource(this.audio);

    // 创建 AnalyserNode 用于获取时域数据（音频流）
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 1024; // 可根据需要调整
    this._analyser.smoothingTimeConstant = 0.8;
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

  seekToPosition(position) {
    // const duration = this.audio.duration || 0;
    // if (duration <= 0) return;
    // const clamped = Math.max(0, Math.min(1, percent));
    this.audio.currentTime = position;
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
    const sliceSize = 128;
    const frequencyData = new Uint8Array(this._analyser.frequencyBinCount);

    // 停止之前的计时器（如果有）
    if (this._audioTimer) clearInterval(this._audioTimer);

    // 使用 setInterval 保证后台运行
    // 16ms 对应约 60fps，如果你想降低 CPU 占用，可以设为 32ms (30fps)
    this._audioTimer = setInterval(() => {
      // 即使窗口隐藏，AudioContext 依然在后台运行，数据依然可以获取
      this._analyser.getByteFrequencyData(frequencyData);
      const visualData = frequencyData.subarray(0, sliceSize);

      // 如果全为 0，说明没声音，可以跳过发送节省性能
      //if (visualData[0] === 0 && visualData[sliceSize - 1] === 0) return;

      ipcRenderer.send("audio-data", visualData);
    }, 16);
  }
}

window.AudioManager = AudioManager;
