// index.js
class TestPlugin {
  constructor() {
    // 必须有的 name 属性
    this.name = "TestPlugin";
  }

  // activate 方法会在管理器加载时被调用，并注入 api
  activate(api) {
    this.api = api;
    this.api.log("TestPlugin 已成功激活，API 已注入。");

    // 注册一个意图，用于前端获取这个插件的 UI 内容
    this.api.registerIntent("get_test_plugin_ui", () => {
      // 假设 api.readUI() 方法已经被 PluginManager 注入并且可以读取同目录下的 html 文件
      const htmlContent = api.readUI ? api.readUI() : `<p>UI内容加载失败或管理器未实现 readUI 方法。</p>`;
      
      return {
        success: true,
        html: htmlContent,
        config: api.get("settings.plugins.TestPlugin", { message: "默认配置信息" })
      };
    });
  }

  // deactivate 方法用于卸载时的清理工作
  deactivate() {
    this.api.log("TestPlugin 正在卸载...");
    // 可以在这里注销意图、关闭连接等
  }
}

// 导出类
module.exports = TestPlugin;
