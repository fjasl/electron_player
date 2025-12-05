// res/js/list_field.js

class ListUIController {
  constructor() {
    this.listBox = document.getElementById("list_box");
    this.filePickBtn = document.getElementById("file_pick_btn");
    this.locateBtn = document.getElementById("list_locate_btn");
    this.findBtn = document.getElementById("list_find_btn");
    this.searchBar = null;

    this.nextId = 1;
    /** 真实歌曲项（不含搜索条） */
    this.items = []; // { id, el, titleText }
    /** 搜索条 list_item */
    this.searchRow = null;
    /** 当前选中的项 id（可选） */
    this.currentId = null;
    //有无搜索条
    this.isSearching = false;

    // 对接后端的回调
    this.callbacks = {
      onItemPlay: null, // 双击播放 (itemData)
      onItemSelect: null, // 单击选中 (itemData)
      onItemAdded: null, // 添加完成 (itemData)
      // 这里的 onItemRemoved = 用户点击删除按钮（删除请求）
      onItemRemoved: null, // (itemData)
      onFilePickClick: null, // 点左侧文件夹按钮
      onFindBtnClick: null, //点击寻找按钮后回调
      onFilterChange: null, // 搜索关键字变化 (keyword)
    };

    this._initExistingItems();
    this._bindTopButtons();
  }

  // ================= 初始化 =================

  _initExistingItems() {
    if (!this.listBox) return;

    const domItems = Array.from(this.listBox.querySelectorAll(".list_item"));

    domItems.forEach((el) => {
      // 跳过以后如果有的搜索条
      if (el.classList.contains("list_item--search")) return;

      const id = `list_item${this.nextId++}`;
      el.id = id;

      const titleDiv = el.querySelector(".list_item_info div:nth-of-type(2)");
      const titleText = titleDiv ? titleDiv.textContent.trim() : "";

      const itemData = { id, el, titleText };
      el.dataset.search = titleText.toLowerCase();

      this._bindItemEvents(itemData);
      this.items.push(itemData);
    });
  }

  _bindTopButtons() {
    if (this.filePickBtn) {
      this.filePickBtn.addEventListener("click", () => {
        this.callbacks.onFilePickClick?.();
      });
    }

    if (this.locateBtn) {
      this.locateBtn.addEventListener("click", () => {
        this.toggleSearchRow();
      });
    }
  }

  _bindItemEvents(itemData) {
    const { el } = itemData;
    const delBox = el.querySelector(".list_item_del_box");

    // 删除按钮（右侧垃圾桶）
    if (delBox) {
      delBox.addEventListener("click", (e) => {
        e.stopPropagation(); // 不触发选中/双击播放
        // 不直接删 DOM，只把“删除请求”抛给外部
        this.callbacks.onItemRemoved?.(itemData);
      });
    }

    // 单击：选中
    el.addEventListener("click", () => {
      if (el.classList.contains("list_item--search")) {
        // 搜索条：单击不选中，只聚焦输入
        const input = el.querySelector("input");
        input && input.focus();
        return;
      }
      this.setCurrentItem(itemData.id);
      this.callbacks.onItemSelect?.(itemData);
    });

    this.findBtn.addEventListener("click", () => {
      this.callbacks.onFindBtnClick?.(this.items);
      this.setCurrentItem(this.currentId);
      this.scrollToCurrentItem();
    });

    // 双击：播放
    el.addEventListener("dblclick", (e) => {
      if (
        el.classList.contains("list_item--search") ||
        e.target.closest(".list_item_del_box")
      ) {
        return;
      }
      this.setCurrentItem(itemData.id);
      this.callbacks.onItemPlay?.(itemData);
    });
  }

  // ============== 对外 API：添加 / 删除 / 选中 ==============

  /**
   * 添加一条歌曲到列表（默认加到末尾）
   * data: { titleText: "标题 - 歌手" }
   */
  addItem(data) {
    if (!this.listBox) return null;

    const id = `list_item${this.nextId++}`;
    const el = document.createElement("div");
    el.className = "list_item list_item--enter";
    el.id = id;

    const titleText = data?.titleText ?? "";

    el.innerHTML = `
      <div class="list_item_info">
        <i class="fa-solid fa-music"></i>
        <div class="text_ellipsis">${titleText}</div>
      </div>
      <div class="list_item_del_box">
        <i class="fa-solid fa-trash-can"></i>
      </div>
    `;

    // 如果有搜索条，就插在搜索条后面；否则直接 append
    if (this.searchRow && this.searchRow.el.parentNode === this.listBox) {
      this.listBox.insertBefore(el, this.searchRow.el.nextSibling);
    } else {
      this.listBox.appendChild(el);
    }

    const itemData = { id, el, titleText };
    el.dataset.search = titleText.toLowerCase();

    this._bindItemEvents(itemData);
    this.items.push(itemData);

    el.addEventListener(
      "animationend",
      () => el.classList.remove("list_item--enter"),
      { once: true }
    );

    this.callbacks.onItemAdded?.(itemData);
    return itemData;
  }

  /** 备选：按 id 删除一项（现在主要用后端重建列表，这个接口可以留着） */
  removeItemById(id) {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return;

    const item = this.items[idx];
    if (!item.el) {
      this.items.splice(idx, 1);
      return;
    }

    const el = item.el;
    el.classList.add("list_item--leave");
    el.addEventListener(
      "animationend",
      () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      },
      { once: true }
    );

    this.items.splice(idx, 1);

    if (this.currentId === id) {
      this.currentId = null;
    }
  }

  setCurrentItem(id) {
    this.currentId = id;

    this.items.forEach((item) => {
      if (!item.el) return;
      const isCurrent = item.id === id;
      item.el.classList.toggle("list_item--current", isCurrent);
      if (isCurrent) {
        item.el.classList.add("list_item--selectPulse");
        item.el.addEventListener(
          "animationend",
          () => item.el.classList.remove("list_item--selectPulse"),
          { once: true }
        );
      }
    });
  }

  /** 获取当前选中项数据（给外部用） */
  getCurrentItem() {
    return this.items.find((it) => it.id === this.currentId) || null;
  }

  getCurrentItem() {
    return this.items.find((it) => it.id === this.currentId) || null;
  }

  /**
   * 将当前选中的项目滚动到视图中央（如果可能）
   * @param {string} [id=this.currentId] - 要滚动的项目ID，默认为当前选中项ID
   */
  scrollToCurrentItem(id = this.currentId) {
    if (!id) return;

    const item = this.items.find((it) => it.id === id);
    if (!item || !item.el) return;

    // 使用原生的 scrollIntoView 方法
    // behavior: 'smooth' 提供平滑滚动动画
    // block: 'center' 尝试将元素顶部与容器中心对齐
    item.el.scrollIntoView({
      behavior: "smooth",
      block: "nearest", // 垂直方向对齐到中央
      // inline: 'nearest' // 水平方向只在需要时滚动（这里不需要）
    });

    // 如果您的列表项不在 listBox 而是其他可滚动容器中，
    // 确保该容器设置了正确的 CSS overflow 属性（如 overflow-y: auto/scroll）。
  }

  // ================== 搜索条（列表项形态） ==================

  toggleSearchRow() {
    if (this.searchRow) {
      this._removeSearchRow();
      this.isSearching = false;
    } else {
      this.isSearching = true;
      this._createSearchRow();
      this.searchBar=document.getElementById("list_search_input");
      this.scrollToCurrentItem("find_item");
    }
  }

  _createSearchRow() {
    if (!this.listBox) return;
    if (this.searchRow) return;

    const el = document.createElement("div");
    el.className = "list_item list_item--enter list_item--search";
    el.id ="find_item";

    el.innerHTML = `
      <div class="list_item_info">
        <i class="fa-solid fa-magnifying-glass"></i>
        <div style="flex:1;">
          <input
            type="text"
            id="list_search_input"
            placeholder="通过标题筛选歌曲."
            style="width:100%;background:transparent;border:none;outline:none;color:#fff;font-size:14px;"
          />
        </div>
      </div>
      <div class="list_item_del_box"></div>
    `;

    // 插到列表最上方
    if (this.listBox.firstChild) {
      this.listBox.insertBefore(el, this.listBox.firstChild);
    } else {
      this.listBox.appendChild(el);
    }

    el.addEventListener(
      "animationend",
      () => el.classList.remove("list_item--enter"),
      { once: true }
    );

    const input = el.querySelector("#list_search_input");
    input.addEventListener("input", (e) => {
      const kw = e.target.value;
      this.applyFilter(kw);
    });

    this.searchRow = { el, input };
    setTimeout(() => input.focus(), 50);
  }

  _removeSearchRow() {
    if (!this.searchRow) return;
    const { el } = this.searchRow;

    el.classList.add("list_item--leave");
    el.addEventListener("animationend", () => el.remove(), { once: true });

    this.searchRow = null;
    this.applyFilter(""); // 恢复全部可见
  }

  /** 根据关键词过滤列表（只操作真实歌曲项） */
  applyFilter(keyword) {
    const kw = keyword.trim().toLowerCase();

    this.items.forEach((item) => {
      const text = (item.titleText ?? "").toLowerCase();
      const match = !kw || text.includes(kw);
      item.el.style.display = match ? "" : "none";
    });

    this.callbacks.onFilterChange?.(kw);
  }
}

// 暴露到全局，方便 main.js 使用
window.ListUIController = ListUIController;
