// class TabController {
//   // 右侧四个页面的顺序
//   constructor(tabOrderIds= ["play", "lyric", "list", "setting"], initialTabId = "play") {
//     this.tabOrder = tabOrderIds; // 例如: ["play", "lyric", "list", "setting"]
//     this.currentIndex = this.tabOrder.indexOf(initialTabId); // 默认激活页面的索引

//     if (this.currentIndex === -1) {
//       console.error(`Initial tab ID "${initialTabId}" not found in tabOrder.`);
//       this.currentIndex = 0; // 找不到则默认使用第一个
//     }

//     // 在 DOM 加载完成后初始化
//     document.addEventListener("DOMContentLoaded", () => {
//       this.applyOffsets();
//       this._bindNavigationButtons();
//     });
//   }

//   // ================= 核心切换逻辑 =================

//   // 根据 currentIndex 计算每个页面的 Y 轴偏移并应用
//   applyOffsets() {
//     this.tabOrder.forEach((name, idx) => {
//       const page = document.getElementById(`content_${name}`);
//       if (!page) return;
//       const offset = (idx - this.currentIndex) * 100; // 一个页面高度为 100%
//       page.style.transform = `translateY(${offset}%)`;
//     });
//   }

//   /**
//    * 对外暴露的切换页面方法
//    * @param {string} tabName - 要切换到的页面的 ID (例如: 'list')
//    */
//   switchTab(tabName) {
//     const idx = this.tabOrder.indexOf(tabName);
//     if (idx === -1 || idx === this.currentIndex) return; // 如果找不到或已经在当前页，则返回
    
//     this.currentIndex = idx;
//     this.applyOffsets(); // 如果 CSS 里有 transition 就会有动画
    
//     // 可选：触发一个自定义事件，通知外部其他组件页面已切换
//     const event = new CustomEvent('tabchange', { detail: { newTab: tabName, newIndex: idx } });
//     document.dispatchEvent(event);
//   }

//   // ================= DOM 事件绑定 =================

//   _bindNavigationButtons() {
//     // 绑定左侧四个按钮点击事件，使用数据属性（data-tab-target）更简洁
//     // 假设您的 HTML 按钮结构如下：
//     // <button id="Play_btn" data-tab-target="play">播放器</button>
//     // ...以此类推...

//     this.tabOrder.forEach(tabName => {
//       // 这里的按钮 ID 格式需要根据您的实际 HTML 调整
//       // 我根据您提供的 ID 进行了绑定
//       let btnId;
//       switch(tabName) {
//         case 'play': btnId = 'Play_btn'; break;
//         case 'lyric': btnId = 'lyric_btn'; break;
//         case 'list': btnId = 'list_btn'; break;
//         case 'setting': btnId = 'setting_btn'; break;
//         default: return;
//       }
      
//       const button = document.getElementById(btnId);

//       if (button) {
//         button.addEventListener("click", () => {
//           this.switchTab(tabName);
//         });
//       }
//     });
//   }
// }

// // 暴露到全局 window 对象（或使用 ES6 模块导出），方便其他脚本使用
// window.TabController = TabController;
class TabController {
  constructor(tabOrderIds = ["play", "lyric", "list", "setting"], initialTabId = "play") {
    this.tabOrder = tabOrderIds;
    this.currentIndex = this.tabOrder.indexOf(initialTabId);

    if (this.currentIndex === -1) {
      console.error(`Initial tab ID "${initialTabId}" not found in tabOrder.`);
      this.currentIndex = 0;
    }

    document.addEventListener("DOMContentLoaded", () => {
      // this._ensureFrameAnimStyle();
      this.applyOffsets();
      this._bindNavigationButtons();
    });
  }

  // 让 right-frame 具备动画（你现在 transition 写在 .tab_content 上了，这里补到容器上）
  _ensureFrameAnimStyle() {
    const frame = document.getElementById("right-frame");
    if (!frame) return;
    if (!frame.style.transition) {
      frame.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
    }
    frame.style.willChange = "transform";
  }

  // ✅ 只移动整体容器 right-frame
  applyOffsets() {
    const frame = document.getElementById("right-frame");

    const step = 100 / this.tabOrder.length; // 4页 => 25
    const offset = -this.currentIndex * step;

    // 注意：translateY(%) 以 right-frame 自身高度为基准（400%）
    // 所以 -25% 刚好等于上移 1 个视口高度
    frame.style.transform = `translateY(${offset}%)`;
  }

  switchTab(tabName) {
    const idx = this.tabOrder.indexOf(tabName);
    if (idx === -1 || idx === this.currentIndex) return;

    this.currentIndex = idx;
    this.applyOffsets();

    const event = new CustomEvent("tabchange", { detail: { newTab: tabName, newIndex: idx } });
    document.dispatchEvent(event);
  }

  _bindNavigationButtons() {
    this.tabOrder.forEach((tabName) => {
      let btnId;
      switch (tabName) {
        case "play": btnId = "Play_btn"; break;
        case "lyric": btnId = "lyric_btn"; break;
        case "list": btnId = "list_btn"; break;
        case "setting": btnId = "setting_btn"; break;
        default: return;
      }

      const button = document.getElementById(btnId);
      if (button) {
        button.addEventListener("click", () => this.switchTab(tabName));
      }
    });
  }
}

window.TabController = TabController;
