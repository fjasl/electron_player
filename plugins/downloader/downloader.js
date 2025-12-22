// MusicSearchPlugin.js
const axios = require("axios");
const cheerio = require("cheerio");

class MusicSearchPlugin {
  constructor() {
    this.name = "MusicDownloaderPlugin"; // 必须属性
    this.api = null;
  }

  /**
   * 插件激活方法，由 PluginManager 调用
   * @param {Object} api 注入的核心 API
   */
  activate(api) {
    this.api = api;
    this.api.log("音乐搜索插件已激活");
    this.api.log("测试");
    // 注册到状态机或监听事件总线
    // 假设您想监听前端传来的搜索请求
    this.api.registerIntent(
      "music_downloader_plugin_quest_search",
      async (payload) => {
        const { keyword } = payload;
        this.api.log(payload.keyword);
        if (!keyword) return;
        this.api.log(payload);
        const results = await this.performSearch(keyword);
        this.api.log(results);
        // 将结果通过事件总线传回前端
        this.api.eventPasser.plug_emit(
          this.name,
          "music_downloader_search_results_reply",
          { results }
        );
      }
    );
  }

  /**
   * 核心搜索逻辑
   * @param {string} keyword 搜索关键词
   */
  async performSearch(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://www.gequbao.com/s/${encodedKeyword}`;

    const headers = {
      "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Referer": "www.gequbao.com",
    };

    try {
      this.api.log(`正在从源搜索: ${keyword}`);
      const response = await axios.get(url, { headers, timeout: 10000 });

      if (response.status !== 200) {
        throw new Error(`HTTP 状态码: ${response.status}`);
      }

      const $ = cheerio.load(response.data);
      const results = [];

      $("div.row").each((index, element) => {
        const row = $(element);
        const col8 = row.find("div.col-8");
        const col4 = row.find("div.col-4");

        if (col8.length === 0 || col4.length === 0) return;

        const linkTag =
          col8.find("a.music-link").length > 0
            ? col8.find("a.music-link")
            : col8.find("a");

        const href = linkTag.attr("href") || "";
        if (!href.startsWith("/music/")) return;

        const title =
          linkTag.find("span.music-title").text().trim() || "未知标题";
        const author =
          linkTag.find("small.text-jade").text().trim() || "未知作者";

        results.push({
          title: title,
          desc: author, // 对应您 UI 中的 desc 字段
          url: `https://www.gequbao.com${href}`,
        });
      });

      this.api.log(`搜索完成，获取到 ${results.length} 条数据`);
      return results;
    } catch (error) {
      this.api.error(`搜索失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 插件卸载逻辑
   */
  deactivate() {
    if (this.api) {
      this.api.log("音乐搜索插件已停用");
    }
  }
}

module.exports = MusicSearchPlugin;
