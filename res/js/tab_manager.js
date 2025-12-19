class TabController {
  constructor(tabOrderIds = ["play", "lyric", "list", "setting"], initialTabId = "play") {
    this.dom = {
      Play_btn: document.getElementById("Play_btn"),
      lyric_btn: document.getElementById("lyric_btn"),
      list_btn: document.getElementById("list_btn"),
      setting_btn: document.getElementById("setting_btn")
    };
    
    this.frame = document.getElementById("right-frame");
    this.currentIndex = tabOrderIds.indexOf(initialTabId);
    
    if (this.currentIndex === -1) {
      console.error(`Initial tab ID "${initialTabId}" not found in tabOrder.`);
      this.currentIndex = 0;
    }

    // 映射关系
    this.navMap = [
      { btnId: "Play_btn", index: 0, name: "play" },
      { btnId: "lyric_btn", index: 1, name: "lyric" },
      { btnId: "list_btn", index: 2, name: "list" },
      { btnId: "setting_btn", index: 3, name: "setting" }
    ];

    this.callbacks = {
      clickPlay: null,
      clickLyric: null,
      clickList: null,
      clickSetting: null
    };

    this.init();
  }

  init() {
    // 绑定按钮事件
    this.dom.Play_btn.addEventListener("click", () => {
      this.switchTo(0);
      this.callbacks.clickPlay?.();
    });
    
    this.dom.lyric_btn.addEventListener("click", () => {
      this.switchTo(1);
      this.callbacks.clickLyric?.();
    });
    
    this.dom.list_btn.addEventListener("click", () => {
      this.switchTo(2);
      this.callbacks.clickList?.();
    });
    
    this.dom.setting_btn.addEventListener("click", () => {
      this.switchTo(3);
      this.callbacks.clickSetting?.();
    });

    // 初始化显示第一页
    this.switchTo(this.currentIndex);
  }

  switchTo(index) {
    if (!this.frame) return;

    // 计算偏移量（每页100%，因为有4页）
    const step = 100 / this.navMap.length;
    const targetY = index * -step;

    this.frame.style.transform = `translateY(${targetY}%)`;
    this.updateActiveStatus(index);
  }

  updateActiveStatus(activeIndex) {
    this.navMap.forEach((item) => {
      const btn = document.getElementById(item.btnId);
      if (btn) {
        if (item.index === activeIndex) {
          btn.classList.add("button_active");
        } else {
          btn.classList.remove("button_active");
        }
      }
    });
  }

  // 兼容原有API的方法
  switchTab(tabName) {
    const targetIndex = this.navMap.findIndex(item => item.name === tabName);
    if (targetIndex !== -1) {
      this.switchTo(targetIndex);
    }
  }
}

// 暴露到全局对象
window.TabController = TabController;