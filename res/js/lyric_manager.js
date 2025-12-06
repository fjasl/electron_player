class LyricManager {
  constructor() {
    this.lyricBox = document.getElementById("lyric_box");
    this.lyricList = []; //{index,el}
  }

  _rebuildLyriclist(lyricArray) {
    let index = 0;
    // 清空现有内容，确保重新构建
    this.lyricBox.innerHTML = "";

    // 遍历传入的歌词数据数组
    lyricArray.forEach((item) => {
      // 创建一个新的 div 元素，并赋予其 .lyric_item 类
      const lyricItem = document.createElement("div");
      lyricItem.classList.add("lyric_item");

      // 设置每个歌词项的内容为对应的 lyricrow
      lyricItem.textContent = item.text;

      // 根据 index 可以选择是否需要对样式做特殊处理
      // 例如设置每个项的高度或者顺序标识
      lyricItem.dataset.index = item.index;

      // 将生成的 lyricItem 添加到 lyricBox 中
      this.lyricBox.appendChild(lyricItem);
      this.lyricList.push({ index, lyricItem });
      index++;
    });
  }
  scrollToCurrentItem(index) {
    if (!index) return;

    const item = this.lyricList.find((it) => it.index === index);
    if (!item || !item.lyricItem) return;

    // 使用原生的 scrollIntoView 方法
    // behavior: 'smooth' 提供平滑滚动动画
    // block: 'center' 尝试将元素顶部与容器中心对齐
    item.lyricItem.scrollIntoView({
      behavior: "smooth",
      block: "nearest", // 垂直方向对齐到中央
      // inline: 'nearest' // 水平方向只在需要时滚动（这里不需要）
    });

    // 如果您的列表项不在 listBox 而是其他可滚动容器中，
    // 确保该容器设置了正确的 CSS overflow 属性（如 overflow-y: auto/scroll）。
  }
}

window.LyricManager = LyricManager;