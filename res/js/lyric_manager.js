class LyricManager {
  constructor() {
    this.lyricBox = document.getElementById("lyric_box");
    this.lyricList = []; //{index,el}
    this.actArr = [];
  }

  _appendArr(index) {
    this.actArr.push(index);
    if (this.actArr.length > 2) {
      this.actArr.shift();
    }
  }
  _rebuildLyriclist(lyricArray) {
    let index = 0;
    // 清空现有内容，确保重新构建
    this.lyricBox.innerHTML = "";
    this.lyricList = [];
    this.actArr = [];
    // 遍历传入的歌词数据数组
    lyricArray.forEach((item) => {
      // 创建一个新的 div 元素，并赋予其 .lyric_item 类
      const lyricItem = document.createElement("div");
      lyricItem.classList.add("lyric_item");

      // 设置每个歌词项的内容为对应的 lyricrow
      lyricItem.textContent = item.text;

      // 根据 index 可以选择是否需要对样式做特殊处理
      // 例如设置每个项的高度或者顺序标识

      // 将生成的 lyricItem 添加到 lyricBox 中
      this.lyricBox.appendChild(lyricItem);
      this.lyricList.push({ index, lyricItem });
      index++;
    });
    this.scrollToCurrentItem(0);
  }
  scrollToCurrentItem(index) {
    this._appendArr(index);
    if (this.actArr.length === 2) {
      this.lyricList[this.actArr[0]].lyricItem.classList.remove(
        "lyric_item_active"
      );
      this.lyricList[this.actArr[1]].lyricItem.classList.add(
        "lyric_item_active"
      );
    } else {
      this.lyricList[this.actArr[0]].lyricItem.classList.add(
        "lyric_item_active"
      );
    }
    const listBox = this.lyricBox;

    if (index == null || !listBox) return;

    // 2. 找到目标歌词项的 DOM 元素
    // 您需要根据您的数据结构获取实际的 DOM 元素引用
    // 假设您的 this.lyricList 结构可以提供 lyricItem DOM 引用：
    const itemData = this.lyricList.find((it) => it.index === index);
    const targetElement = itemData ? itemData.lyricItem : null;

    if (!targetElement) return;

    // --- 核心滚动逻辑 ---

    // 获取目标元素相对于其 offsetParent（通常是 listBox）顶部的距离
    const elementOffsetTop = targetElement.offsetTop;

    // 获取容器的可见高度
    const containerHeight = listBox.clientHeight;

    // 获取目标元素自身的高度
    const elementHeight = targetElement.clientHeight;

    // 计算理想的滚动位置：
    // 目标元素的顶部位置 减去 (容器高度 / 2) 加上 (元素高度 / 2)，使元素中心对齐容器中心
    const scrollTo = elementOffsetTop - containerHeight / 2 + elementHeight / 2;

    // 使用 behavior: 'smooth' 实现平滑滚动（这是现代浏览器支持的）
    listBox.scrollTo({
      top: scrollTo,
      behavior: "smooth",
    });
  }
}

window.LyricManager = LyricManager;
