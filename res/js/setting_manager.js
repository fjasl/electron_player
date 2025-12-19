/**
 * SettingManager - 增强版 (集成日志管理)
 */
class SettingManager {
  constructor() {
    this.dom = {
      plugBtn: document.getElementById("plug_btn"),
      wrenchBtn: document.getElementById("wrench_btn"),
      logBtn: document.getElementById("log_btn"),
      infoBtn: document.getElementById("info_btn"),
      plugBox: document.getElementById("setting_plug_box"), // 插件容器
      wrenchViewIframe: document.querySelector("#wrench_view iframe"),
    };
    this.frame = document.getElementById("setting_view_frame");
    // 获取日志输出文本框
    this.logOutput = document.getElementById("logOutput");
    // 最大日志条目数限制
    this.MAX_LOG_ENTRIES = 50;

    this.plugItems = [];
    this.activePlugName = null;

    // 映射关系
    this.navMap = [
      { btnId: "plug_btn", index: 0, name: "插件" },
      { btnId: "wrench_btn", index: 1, name: "维护" },
      { btnId: "log_btn", index: 2, name: "日志" },
      { btnId: "info_btn", index: 3, name: "信息" },
    ];

    this.callbacks = {
      clickPlug: null,
      clickWrench: null,
      clickLog: null,
      clickInfo: null,
      onPlugSelected: null, // 当插件 item 被点击时的回调
    };

    this.init();
    this.setupIframeCommunication();
  }

  init() {
    this.dom.plugBtn.addEventListener("click", () => {
      this.switchTo(0);
      this.callbacks.clickPlug?.();
    });
    this.dom.wrenchBtn.addEventListener("click", () => {
      this.switchTo(1);
      this.callbacks.clickWrench?.();
    });
    this.dom.logBtn.addEventListener("click", () => {
      this.switchTo(2);
      this.callbacks.clickLog?.();
    });
    this.dom.infoBtn.addEventListener("click", () => {
      this.switchTo(3);
      this.callbacks.clickInfo?.();
    });

    // 初始化显示第一页
    this.switchTo(0);
    this.addLog("默认页面已加载。");
  }

  switchTo(index) {
    if (!this.frame) return;

    const step = 25;
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
  /**
   * 动态添加插件 Item
   * @param {string} name 插件名称
   * @param {string} iconClass 图标类名 (FontAwesome)
   */
  addPlugItem(name, iconClass = "fa-solid fa-code") {
    if (!this.dom.plugBox) return;

    const item = document.createElement("div");
    item.className = "setting_plug_item"; // 使用你定义的样式
    item.dataset.name = name; // 存入标识符
    item.title = name;
    item.innerHTML = `
      <div class="plug_item_icon"><i class="${iconClass}"></i></div>
      <div class="plug_item_name">${name}</div>
    `;

    // 绑定点击事件
    item.addEventListener("click", () => {
      this.selectPlug(name);
    });

    this.dom.plugBox.appendChild(item);
    this.plugItems.push({ name, dom: item });

    // 默认选中第一个添加的插件
    if (this.plugItems.length === 1) {
      this.selectPlug(name);
    }
  }

  /**
   * 选中某个插件 Item
   * @param {string} name 插件名称
   */
  selectPlug(name) {
    this.activePlugName = name;

    // 更新 UI 样式
    this.plugItems.forEach((item) => {
      if (item.name === name) {
        item.dom.classList.add("plug_item_active");
      } else {
        item.dom.classList.remove("plug_item_active");
      }
    });

    this.addLog(`已选中插件: ${name}`);

    // 执行外部回调（用于通知其他模块切换维护页内容等）
    if (this.callbacks.onPlugSelected) {
      this.callbacks.onPlugSelected(name);
    }
  }

  /**
   * [新增方法] 格式化并添加日志到文本区域，并进行滚动和条数限制
   * @param {string} message 要添加的日志内容
   */
  addLog(message) {
    if (!this.logOutput) return;

    // 格式化时间 HH:MM:SS
    const now = new Date();
    const timeString = now.toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // 格式化日志字符串：[hh:mm:ss]: content + 换行
    const formattedLog = `[${timeString}]: ${message}\n`;

    // 追加到文本框
    this.logOutput.value += formattedLog;

    // 限制日志行数（只保留最后50行）
    this.limitLogs();

    // 自动滚动到底部
    this.logOutput.scrollTop = this.logOutput.scrollHeight;
  }
  /**
   * [新增方法] 接收 HTML 字符串并渲染到 wrench_view 的 iframe 中
   * @param {string} htmlString 要渲染的 HTML 内容
   */
  renderWrenchViewUI(htmlString) {
    if (!this.dom.wrenchViewIframe) {
      console.error("无法找到 wrench_view 中的 iframe 元素。");
      return;
    }
    this.dom.wrenchViewIframe.srcdoc = htmlString;
  }
  setupIframeCommunication() {
    window.addEventListener("message", (event) => {
      if (event.data && event.data.source === "iframe-plugin-api") {
        const { intent, payload } = event.data;

        // 打印日志，方便调试
        this.addLog(`主窗口收到来自 iframe 的意图: ${intent}`);
        sendIntent("server_plugin_port", { port: payload });
        console.log(`Intent: ${intent}, Payload:`, payload);
      }
    });
  }
  /**
   * [新增私有方法] 限制日志条目为50条
   */
  limitLogs() {
    const lines = this.logOutput.value.split("\n");
    if (lines.length > this.MAX_LOG_ENTRIES + 1) {
      // +1 因为最后通常有个空行
      // 移除旧的行，只保留最新的 N 行
      const newLogs = lines.slice(-(this.MAX_LOG_ENTRIES + 1)).join("\n");
      this.logOutput.value = newLogs;
    }
  }
}

// 页面加载完成后启动
window.SettingManager = SettingManager;
