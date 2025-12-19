// plugin_manager.js
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const {app} = require("electron");

class PluginManager extends EventEmitter {
  constructor(pluginDir = path.join(app.getAppPath(), "plugins")) {
    super();
    this.pluginDir = pluginDir;
    this.plugins = new Map(); // name -> { instance, module, watcher, enabled }
    this.deps = null;
    this.ensurePluginDir();
  }

  injectDeps(deps) {
    this.deps = deps;
  }

  // 确保 plugins 目录存在
  ensurePluginDir() {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
      if (!this.deps) {
        throw new Error(`[PluginManager] 核心依赖尚未注入，无法创建 API`);
      }
      console.log(`[PluginManager] 创建插件目录: ${this.pluginDir}`);
      this.deps.eventBus.log(`[PluginManager] 创建插件目录: ${this.pluginDir}`);
    }
  }

  // 加载所有插件
  loadAll() {
    const files = fs
      .readdirSync(this.pluginDir)
      .filter((file) => file.endsWith(".js"));
    this.deps.eventBus.log(
      `[PluginManager] 发现 ${files.length} 个插件文件，正在加载...`
    );
    for (const file of files) {
      this.loadPlugin(file);
    }

    this.deps.eventBus.log(
      `[PluginManager] 所有插件加载完成，共 ${this.plugins.size} 个`
    );
  }

  加载单个插件
  loadPlugin(filename) {
    const filePath = path.join(this.pluginDir, filename);

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

      // 初始化插件，注入核心 API
      const api = this.createPluginAPI(pluginName);

      if (typeof pluginInstance.activate === "function") {
        pluginInstance.activate(api);
      } else if (typeof pluginInstance.init === "function") {
        pluginInstance.init(api); // 兼容旧写法
      }

      // 设置文件监视（热重载）
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === "change") {
          this.deps.eventBus.log(
            `[PluginManager] 检测到插件修改: ${filename}，正在热重载...`
          );
          this.reloadPlugin(pluginName);
        }
      });

      this.plugins.set(pluginName, {
        instance: pluginInstance,
        module: PluginModule,
        filePath,
        filename,
        watcher,
        enabled: true,
      });
      this.deps.eventBus.log(
        `[PluginManager] 插件加载成功: ${pluginName} (${filename})`
      );

      // 触发事件通知其他插件或系统
      this.emit("plugin-loaded", {
        name: pluginName,
        instance: pluginInstance,
      });
    } catch (err) {
      this.deps.eventBus.log(
        `[PluginManager] 加载插件失败 ${filename}:`,
        err.message
      );
    }
  }

 

  // 重载插件（热重载核心）
  reloadPlugin(name) {
    const info = this.plugins.get(name);
    if (!info) return false;

    this.deps.eventBus.log(`[PluginManager] 正在重载插件: ${name}`);

    // 先卸载
    this.unloadPlugin(name, false); // false 表示不关闭 watcher

    // 再加载
    this.loadPlugin(info.filename);
    return true;
  }

  // 卸载插件
  unloadPlugin(name, closeWatcher = true) {
    const info = this.plugins.get(name);
    if (!info) return false;

    try {
      if (typeof info.instance.deactivate === "function") {
        info.instance.deactivate();
      }

      if (closeWatcher && info.watcher) {
        info.watcher.close();
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
    const { stateStore, eventBus, stateMachine } = this.deps;
    return {
      name: pluginName,
      log: (...args) => eventBus.log(`[${pluginName}]`, ...args),
      error: (...args) => eventBus.log(`[${pluginName}]`, ...args),

      // 状态访问
      getState: () => stateStore.getState(),
      get: (path, fallback) => stateStore.get(path, fallback),

      // 事件监听
      on: (event, callback) => eventBus.on(event, callback),
      once: (event, callback) => eventBus.once(event, callback),
      off: (event, callback) => eventBus.off?.(event, callback),

      // 注册自定义意图
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
