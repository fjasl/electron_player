class PlayUIController {
  constructor() {
    // ===== 获取所有界面元素 =====
    this.dom = {
      // 基本信息
      title: document.getElementById("songtitle"),
      artist: document.getElementById("songartist"),

      //音量条
      volumeBox: document.getElementById("volume_bar_box"),
      volumeTrack: document.getElementById("volume_bar_track"),
      volumeFill: document.getElementById("volume_bar_fill"),

      // 控制按钮
      btnRetu: document.getElementById("return_btn"),
      btnPlay: document.getElementById("control_play_btn"),
      btnNext: document.getElementById("control_next_btn"),
      btnPrev: document.getElementById("control_forward_btn"),

      // 功能按钮
      btnLike: document.getElementById("like_btn"),
      btnPlayMode: document.getElementById("playmode_btn"),
      btnLyricJump: document.getElementById("lyricjump_btn"),
      btnVolume: document.getElementById("volume_btn"),

      // 播放进度
      track: document.getElementById("progress_track"),
      fill: document.getElementById("progress_fill"),
      posLabel: document.getElementById("position"),
      durationLabel: document.getElementById("duration"),

      // disco 封面
      disco: document.getElementById("disco"),
      discoCover: document.getElementById("disco_cover"),
    };

    // 播放状态
    this.isPlaying = false;
    this.isLiked = false;
    this.playMode = "one"; // loop | one | shuffle

    // 回调接口（让后端 / 播放核心接管）
    this.callbacks = {
      onReturn: null,
      onPlayToggle: null,
      onNext: null,
      onPrev: null,
      onLikeToggle: null,
      onModeChange: null,
      onSeek: null,
      onLyricJump: null,
      onVolumeClick: null,
      onVolumeChange: null,
    };

    this.bindEvents();
  }

  // ================================
  // 事件绑定
  // ================================
  bindEvents() {
    //返回
    this.dom.btnRetu.addEventListener("click", () => {
      this.callbacks.onReturn?.();
    });
    // 播放/暂停
    this.dom.btnPlay.addEventListener("click", () => {
      // this.togglePlayUI();
      this.callbacks.onPlayToggle?.();
    });

    // 下一曲
    this.dom.btnNext.addEventListener("click", () => {
      this.callbacks.onNext?.();
    });

    // 上一曲
    this.dom.btnPrev.addEventListener("click", () => {
      this.callbacks.onPrev?.();
    });

    // 喜欢
    this.dom.btnLike.addEventListener("click", () => {
      // 图标只允许从「未点击」变成「已点击」，不能再切回去
      if (!this.isLiked) {
        this.isLiked = true;
        this.updateLikeUI(); // fa-regular -> fa-solid
        this.callbacks.onLikeToggle?.();
      }
      // 只有第一次点，才会把“我点了一下”这个意图丢给后端
    });

    // 播放模式切换
    this.dom.btnPlayMode.addEventListener("click", () => {
      this.switchPlayMode();
      this.callbacks.onModeChange?.(this.playMode);
    });

    // 点击进度条跳转
    this.dom.track.addEventListener("click", (e) => {
      const rect = this.dom.track.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.callbacks.onSeek?.(percent);
    });

    // 跳转到歌词界面
    this.dom.btnLyricJump.addEventListener("click", () => {
      this.callbacks.onLyricJump?.();
    });

    this.dom.btnVolume.addEventListener("click", () => {
      this.callbacks.onVolumeClick?.();
      this.showVolumeBar();
    });

    // ===== 点击音量条调整音量 =====
    this.dom.volumeTrack?.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止触发 document click 隐藏

      const rect = this.dom.volumeTrack.getBoundingClientRect();

      // 从底部向上计算（符合你的 UI）
      const offsetY = rect.bottom - e.clientY;
      let percent = offsetY / rect.height;

      // clamp 到 0~1
      percent = Math.max(0, Math.min(1, percent));

      // 更新 UI
      this.callbacks.onVolumeChange?.(percent);
      // 通知后端 / audio
    });

    // 保持原有鼠标悬浮不消失逻辑
    this.dom.volumeBox?.addEventListener("mouseenter", () => {
      clearTimeout(this._volumeHideTimer);
    });

    this.dom.volumeBox?.addEventListener("mouseleave", () => {
      clearTimeout(this._volumeHideTimer);
      this._volumeHideTimer = setTimeout(() => {
        this.hideVolumeBar();
      }, 1200);
    });

    this.dom.volumeBox?.addEventListener("mouseenter", () => {
      clearTimeout(this._volumeHideTimer);
    });

    this.dom.volumeBox?.addEventListener("mouseleave", () => {
      clearTimeout(this._volumeHideTimer);
      this._volumeHideTimer = setTimeout(() => {
        this.hideVolumeBar();
      }, 1200);
    });
  }

  // ================================
  // UI 更新接口（后端可随时调用）
  // ================================

  showVolumeBar() {
    if (!this.dom.volumeBox) return;
    this.dom.volumeBox.classList.remove("hide");
    this.dom.volumeBox.classList.add("show");

    clearTimeout(this._volumeHideTimer);
    this._volumeHideTimer = setTimeout(() => {
      this.hideVolumeBar();
    }, 1600);
  }

  hideVolumeBar() {
    if (!this.dom.volumeBox) return;
    this.dom.volumeBox.classList.remove("show");
    this.dom.volumeBox.classList.add("hide");
  }

  toggleVolumeBar() {
    if (!this.dom.volumeBox) return;
    if (this.dom.volumeBox.classList.contains("show")) {
      this.hideVolumeBar();
    } else {
      this.showVolumeBar();
    }
  }

  /** 更新标题与歌手 */
  setSongInfo(title, artist) {
    this.dom.title.textContent = title;
    this.dom.artist.textContent = artist;
  }

  /** 更新播放状态（后端 → UI） */
  setPlayState(isPlaying) {
    this.isPlaying = isPlaying;
    this.updatePlayButton();
    this.updateDiscoAnimation();
  }

  /** 更新进度条（后端定时调用） */
  setProgress(position, duration) {
    this.dom.posLabel.textContent = this.formatTime(position);
    this.dom.durationLabel.textContent = this.formatTime(duration);
    //this.dom.fill.style.width = (position / duration) * 100 + "%";
    const scaleFactor = position / duration;
    this.dom.fill.style.transform = `scaleX(${scaleFactor})`;
  }

  /** 设置是否为喜欢状态 */
  setLiked(isLiked) {
    this.isLiked = isLiked;
    this.updateLikeUI();
  }

  /** 设置播放模式（loop | one | shuffle） */
  setMode(mode) {
    this.playMode = mode;
    this.updateModeUI(mode);
  }

  /** 更新封面图片 */
  setCover(url) {
    this.dom.discoCover.style.backgroundImage = `url(${url})`;
  }

  // ================================
  // UI 内部更新函数
  // ================================
  togglePlayUI() {
    this.isPlaying = !this.isPlaying;
    this.updatePlayButton();
    this.updateDiscoAnimation();
  }

  updatePlayButton() {
    const icon = this.dom.btnPlay.querySelector("i");
    icon.className = this.isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
  }

  updateDiscoAnimation() {
    if (this.isPlaying) {
      this.dom.disco.style.animationPlayState = "running";
    } else {
      this.dom.disco.style.animationPlayState = "paused";
    }
  }

  updateLikeUI() {
    const icon = this.dom.btnLike.querySelector("i");
    icon.className = this.isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
  }

  switchPlayMode() {
    const modes = ["shuffle", "single_loop"];
    let index = modes.indexOf(this.playMode);
    this.playMode = modes[(index + 1) % modes.length];
    this.updateModeUI();
  }

  updateModeUI(mode) {
    const icon = this.dom.btnPlayMode.querySelector("i");
    if (mode === "single_loop") icon.className = "fa-solid fa-repeat";
    else if (mode === "shuffle") icon.className = "fa-solid fa-shuffle";
  }

  updateVolumeUI(volume) {
    const icon = this.dom.btnVolume.querySelector("i");

    if (volume === 0) {
      icon.className = "fa-solid fa-volume-mute";
    }
    if (volume > 0 && volume < 0.5) {
      icon.className = "fa-solid fa-volume-low";
    } else if (volume > 0.5 && volume < 1) {
      icon.className = "fa-solid fa-volume-high";
    }
  }

  // ================================
  // 音量 UI 更新
  // ================================
  setVolume(volume01) {
    this.volume = Math.max(0, Math.min(1, volume01));
    this.updateVolumeUI(this.volume);
    if (this.dom.volumeFill) {
      this.dom.volumeFill.style.height = `${this.volume * 100}%`;
    }
  }

  // ================================
  // 工具
  // ================================
  formatTime(sec) {
    sec = Math.floor(sec);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }
}

// ================================
// 导出类
// ================================
window.PlayUIController = PlayUIController;
