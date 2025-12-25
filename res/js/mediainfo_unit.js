class MediaControl {
  constructor() {
    // 初始化时检查是否支持 MediaSession API
    if ("mediaSession" in navigator) {
      this.mediaSession = navigator.mediaSession;

      this._initMediaSession();
      this.meta = new MediaMetadata({
        title: "",
        artist: "",
        artwork: [{ src: "", sizes: "96x96", type: "image/jpg" }],
      });
      this.callbacks = {
        onPlay: null,
        onPause: null,
        onNext: null,
        onPrev: null,
      };
    } else {
      console.warn("Your browser does not support MediaSession API.");
    }
    //[{ src: cover, sizes: "96x96", type: "image/jpg" },]
  }

  updateTitle(title) {
    if (this.meta) {
      this.meta.title = title;
      navigator.mediaSession.metadata = this.meta; // 更新 MediaSession
    }
  }

  updateArtist(artist) {
    if (this.meta) {
      this.meta.artist = artist;
      navigator.mediaSession.metadata = this.meta; // 更新 MediaSession
    }
  }

  updateArtwork(cover) {
    if (this.meta) {
      this.meta.artwork = [{ src: cover, sizes: "96x96", type: "image/jpg" }]; // artwork 应为图像对象或者 base64 数据
      navigator.mediaSession.metadata = this.meta; // 更新 MediaSession
    }
  }

  // 初始化 MediaSession 并设置默认回调
  _initMediaSession() {
    this.mediaSession.setActionHandler("play", () => {
    this.callbacks.onPlay?.();  
    });

    this.mediaSession.setActionHandler("pause", () => {
      this.callbacks.onPause?.();
    });

    this.mediaSession.setActionHandler("nexttrack", () => {
      this.callbacks.onNext?.();
    });

    this.mediaSession.setActionHandler("previoustrack", () => {
      this.callbacks.onPrev?.();
    });
  }

  
}

window.MediaControl = MediaControl;