// 右侧四个页面的顺序
const tabOrder = ["play", "lyric", "list", "setting"];
let currentIndex = 0; // 当前激活的页面索引

// 根据 currentIndex 计算每个页面的 Y 轴偏移
function applyOffsets() {
  tabOrder.forEach((name, idx) => {
    const page = document.getElementById(`content_${name}`);
    if (!page) return;
    const offset = (idx - currentIndex) * 100; // 一个页面高度为 100%
    page.style.transform = `translateY(${offset}%)`;
  });
}

// 切换页面
function switchTab(tab) {
  const idx = tabOrder.indexOf(tab);
  if (idx === -1) return;
  currentIndex = idx;
  applyOffsets(); // 如果 CSS 里有 transition 就会有动画
}

// DOM 加载完成后初始化位置 + 绑定点击事件 + 播放器逻辑
document.addEventListener("DOMContentLoaded", () => {
  // 初始化位置
  applyOffsets();

  // 左侧四个按钮绑定点击
  const playTabBtn = document.getElementById("Play_btn");
  const lyricTabBtn = document.getElementById("lyric_btn");
  const listTabBtn = document.getElementById("list_btn");
  const settingTabBtn = document.getElementById("setting_btn");

  if (playTabBtn) {
    playTabBtn.addEventListener("click", () => {
      switchTab("play");
    });
  }
  if (lyricTabBtn) {
    lyricTabBtn.addEventListener("click", () => {
      switchTab("lyric");
    });
  }
  if (listTabBtn) {
    listTabBtn.addEventListener("click", () => {
      switchTab("list");
    });
  }
  if (settingTabBtn) {
    settingTabBtn.addEventListener("click", () => {
      switchTab("setting");
    });
  }
});