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
    };
    this.frame = document.getElementById("setting_view_frame");
    // 获取日志输出文本框
    this.logOutput = document.getElementById("logOutput");
    // 最大日志条目数限制
    this.MAX_LOG_ENTRIES = 50;

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
    };

    this.init();
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
