// plugin_manager.js
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const { app } = require("electron");
const { handlers } = require("./state_machine");
const storage = require("./units/storage");

class PluginManager extends EventEmitter {
  constructor(deps) {
    super();
    const appPath = app.getAppPath();
    const joinedPath = path.resolve(appPath, "../../");
    this.pluginDir = path.join(joinedPath, "plugins");
    this.plugins = new Map(); // name -> { instance, module, enabled }
    this.deps = deps;
    this.Pluglist = []; // 存储扫描到的插件元数据
    this.deps.eventBus.log("[PluginManager] 插件管理器初始化完成");
    this.callbacks = {
      plug_ui_loaded: [],
    };
  }

  // 确保 plugins 目录存在
  ensurePluginDir() {
    this.deps.eventBus.log("[PluginManager] 审查插件目录是否存在");
    if (!fs.existsSync(this.pluginDir)) {
      this.deps.eventBus.log(`[PluginManager] 创建插件目录: ${this.pluginDir}`);
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }
  }

  // 加载所有插件 (修改版：支持二级目录检测)
  loadAll() {
    this.deps.eventBus.log(this.pluginDir);
    this.Pluglist = [];
    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(this.pluginDir, entry.name);
        const files = fs.readdirSync(folderPath);

        const jsFiles = files.filter((f) => f.endsWith(".js"));
        const htmlFiles = files.filter((f) => f.endsWith(".html"));

        if (jsFiles.length === 1) {
          const jsName = jsFiles[0];
          const htmlName = htmlFiles.length > 0 ? htmlFiles[0] : null;

          // 记录到 Pluglist
          this.Pluglist.push({
            plugpath: path.join(folderPath, jsName),
            plugUI: htmlName ? path.join(folderPath, htmlName) : null,
          });
          // 直接调用你原本的 loadPlugin 逻辑
          // 注意：传给 loadPlugin 的是相对于 pluginDir 的路径，如 "folder/plugin.js"
          const pluginName = this.loadPlugin(path.join(entry.name, jsName));
          this.deps.eventBus.emit("plugin_loaded", { name: pluginName });
        } else if (jsFiles.length > 1) {
          this.deps.eventBus.log(
            `[PluginManager] 跳过 ${entry.name}: JS数量错误`
          );
        }
      }
    }
    this.deps.eventBus.log(
      `[PluginManager] 扫描并尝试加载了 ${this.Pluglist.length} 个插件`
    );
  }
  registerUIRequestIntent() {
    if (!this.deps || !this.deps.stateMachine) {
      console.error("[PluginManager] 无法注册意图：缺少状态机依赖。");
      return;
    }

    // 注册意图 "plugin_ui_request"
    this.deps.stateMachine.registerHandler("plugin_ui_request", (payload) => {
      const pluginName = payload.name;
      this.deps.eventBus.log("2" + pluginName);
      this.deps.eventBus.log("3" + this.plugins.get(pluginName).filename);
      const htmlContent = this.getPluginUIHtml(
        this.plugins.get(pluginName).filename
      );
      if (htmlContent) {
        // 如果成功获取 HTML，通过 EventBus 发送回复到前端主窗口
        // 事件名为 "plugin_ui_reply"
        this.deps.eventBus.emit("plugin_ui_reply", { html: htmlContent });
        this.deps.eventBus.log(`[PluginManager] 已响应 UI 请求: ${pluginName}`);
        this.callbacks.plug_ui_loaded?.forEach((callback) => {
          callback(pluginName);
        });
      } else {
        // 发送一个失败回复
        this.deps.eventBus.emit("plugin_ui_reply", {
          html: `<p style="padding: 20px;">无法加载 UI。</p>`,
        });
      }

      // 注意：registerHandler 的返回值通常不直接影响前端，而是通过 EventBus 广播。
      return { success: !!htmlContent };
    });
  }
  /**
   * [新增方法] 根据插件名称获取其 UI HTML 内容
   * @param {string} pluginName 插件名称 (文件夹名)
   * @returns {string|null} HTML 字符串或 null
   */
  getPluginUIHtml(pluginName) {
    // 从 this.Pluglist 中查找对应的元数据
    const pluginMeta = this.Pluglist.find((meta) => {
      // 使用 path 模块获取文件名，并移除扩展名
      const fileName = path.basename(meta.plugpath);
      if (fileName === pluginName) {
        return meta.plugUI;
      }
      // 将文件名与请求的名称进行比较
    });
    if (pluginMeta && pluginMeta.plugUI) {
      try {
        // 使用 fs 模块同步读取 HTML 文件内容
        const htmlContent = fs.readFileSync(pluginMeta.plugUI, "utf8");
        return htmlContent;
      } catch (err) {
        this.deps.eventBus.log(
          `[PluginManager] 无法读取 ${pluginName} 的 UI 文件: ${err.message}`
        );
        return null;
      }
    } else {
      this.deps.eventBus.log(
        `[PluginManager] 未找到插件 ${pluginName} 或其 UI 文件路径。`
      );
      return null;
    }
  }
  //加载单个插件;
  loadPlugin(filename) {
    const filePath = path.join(this.pluginDir, filename);
    let pluginname = null;

    // 如果已经加载过，先卸载
    const existingName = [...this.plugins.entries()].find(
      ([, info]) => info.filePath === filePath
    )?.[0];
    if (existingName) {
      this.unloadPlugin(existingName);
    }

    try {
      // 清除 require 缓存，实现热重载
      delete require.cache[require.resolve(filePath)];

      const PluginModule = require(filePath);

      // 支持 CommonJS 和 ES6 默认导出
      const PluginClass = PluginModule.default || PluginModule;
      if (typeof PluginClass !== "function") {
        this.deps.eventBus.log(
          `[PluginManager] ${filename} 未导出一个类，跳过`
        );
        return;
      }

      const pluginInstance = new PluginClass();
      // 插件必须有 name 属性
      if (!pluginInstance.name || typeof pluginInstance.name !== "string") {
        this.deps.eventBus.log(
          `[PluginManager] ${filename} 缺少 name 属性，跳过`
        );
        return;
      }
      const pluginName = pluginInstance.name;
      pluginname = pluginName;

      // 初始化插件，注入核心 API
      const api = this.createPluginAPI(pluginName);
      if (typeof pluginInstance.activate === "function") {
        pluginInstance.activate(api);
      } else if (typeof pluginInstance.init === "function") {
        pluginInstance.init(api); // 兼容旧写法
      }

      this.plugins.set(pluginName, {
        instance: pluginInstance,
        module: PluginModule,
        filePath,
        filename: filename.split("\\").pop(),
        enabled: true,
      });
      this.deps.eventBus.log(
        `[PluginManager] 插件加载成功: ${pluginName} (${filename})`
      );
      // 触发事件通知其他插件或系统
      
    } catch (err) {
      this.deps.eventBus.log(
        `[PluginManager] 加载插件失败 ${filename}:`,
        err.message
      );
      this.deps.eventBus.log(
        `[PluginManager] 加载插件失败 ${filename} Stack:`,
        err.stack
      );
    }
    return pluginname;
  }

  // 卸载插件
  unloadPlugin(name /*closeWatcher = true*/) {
    const info = this.plugins.get(name);
    if (!info) return false;

    try {
      if (typeof info.instance.deactivate === "function") {
        info.instance.deactivate();
      }

      this.plugins.delete(name);
      this.deps.eventBus.log(`[PluginManager] 插件已卸载: ${name}`);
      this.emit("plugin-unloaded", { name });
      return true;
    } catch (err) {
      this.deps.eventBus.log(
        `[PluginManager] 卸载插件失败 ${name}:`,
        err.message
      );
      return false;
    }
  }

  // 启用/禁用插件
  togglePlugin(name, enabled = true) {
    const info = this.plugins.get(name);
    if (!info) return false;

    info.enabled = enabled;
    if (enabled && typeof info.instance.activate === "function") {
      info.instance.activate(this.createPluginAPI(name));
    } else if (!enabled && typeof info.instance.deactivate === "function") {
      info.instance.deactivate();
    }
    return true;
  }

  // 获取插件实例
  getPlugin(name) {
    return this.plugins.get(name)?.instance || null;
  }

  // 获取所有插件信息
  getAllPlugins() {
    return Array.from(this.plugins.entries()).map(([name, info]) => ({
      name,
      enabled: info.enabled,
      filename: info.filename,
    }));
  }

  // 创建插件可用的 API（作用域控制）
  createPluginAPI(pluginName) {
    if (!this.deps) {
      throw new Error(`[PluginManager] 核心依赖尚未注入，无法创建 API`);
    }
    const { stateStore, eventBus, stateMachine, storage, LrcParser } =
      this.deps;
    return {
      name: pluginName,
      callbacks: this.callbacks,
      lyricPasser: LrcParser,
      storagePasser: storage,
      eventPasser: eventBus,
      log: (...args) => eventBus.log(`[${pluginName}]`, ...args),
      error: (...args) => eventBus.log(`[${pluginName}]`, ...args),
      statePasser: stateStore,
      // 状态访问
      getState: () => stateStore.getState(),
      get: (path, fallback) => stateStore.get(path, fallback),

      // 事件监听
      on: (event, callback) => eventBus.on(event, callback),
      once: (event, callback) => eventBus.once(event, callback),
      off: (event, callback) => eventBus.off?.(event, callback),
      handlersPasser: stateMachine,
      // 注册自定义意图处理
      registerIntent: (intent, handler) => {
        stateMachine.registerHandler(intent, handler);
        eventBus.log(`[${pluginName}] 注册意图: ${intent}`);
      },

      // 触发事件（插件间通信）
      emit: (event, payload) => this.emit(event, { from: pluginName, payload }),
    };
  }
}

module.exports = PluginManager;
