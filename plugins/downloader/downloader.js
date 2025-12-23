// MusicSearchPlugin.js
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const NodeID3 = require("node-id3");

class MusicSearchPlugin {
  constructor() {
    this.name = "MusicDownloaderPlugin"; // 必须属性
    this.api = null;
    this.currentList = [];
    this.Dir = "C:\\Users\\27576\\Desktop\\tmp\\download";
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

    this.api.registerIntent(
      "music_downloader_plugin_list_click",
      async (payload) => {
        const { index } = payload;
        this.api.log(this.currentList);
        this.api.log(this.currentList[index]);
        this.api.log("点击了第" + index + "项");
        await this.analysInfo(this.currentList[index].url);
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
      Referer: "www.gequbao.com",
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
      this.currentList = results;
      return results;
    } catch (error) {
      this.api.error(`搜索失败: ${error.message}`);
      return [];
    }
  }
  async analysInfo(url) {
    this.api.log("正在尝试分析信息");
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://www.gequbao.com/",
    };
    try {
      this.api.log(`正在从分析信息: ${url}`);
      const response = await axios.get(url, { headers, timeout: 10000 });

      if (response.status !== 200) {
        throw new Error(`HTTP 状态码: ${response.status}`);
      }

      const html = response.data;

      // 1. 提取并解析 window.appData
      const appDataMatch = html.match(/window\.appData\s*=\s*(\{.*?\});/s);
      if (appDataMatch) {
        const jsonStr = appDataMatch[1];
        let appData;
        try {
          appData = JSON.parse(jsonStr);
        } catch (e) {
          console.log("解析 window.appData 的 JSON 失败:", e.message);
          return;
        }
        const Data = {
          title: appData.mp3_title,
          author: appData.mp3_author,
          playid: appData.play_id,
          cover: appData.mp3_cover,
          haslyric: appData.lrc_is_empty,
        };

        const $ = cheerio.load(html);
        const lrcElement = $("#content-lrc");

        if (lrcElement.length > 0) {
          // cheerio 的 .text() 默认会把所有子节点文本用空格连接，这里我们手动处理换行
          // 取出所有直接子节点（通常是 <p> 或 <br>），并按行输出
          const lines = [];
          lrcElement.contents().each((i, el) => {
            if (el.type === "text") {
              const text = $(el).text().trim();
              if (text) lines.push(text);
            } else if (el.tagName === "br") {
              lines.push(""); // <br> 表示换行
            } else {
              // 对于其他标签（如 <p>），取出其文本
              const text = $(el).text().trim();
              if (text) lines.push(text);
            }
          });

          const lrcText = lines.join("\n").trim();

          this.api.log("\n=== 歌词内容 (LRC 格式) ===");
          this.api.log(lrcText);

          // 可选：保存为 .lrc 文件
          // const fs = require('fs');
          // const songName = appData?.mp3_title || 'unknown';
          // fs.writeFileSync(`${songName}.lrc`, lrcText, 'utf-8');
          // console.log(`\n歌词已保存为 ${songName}.lrc`);
          const lrcPath = path.join(
            this.Dir,
            `${Data.title.replace(/[\\/:*?"<>|]/g, "_")}.lrc`
          );
          fs.writeFileSync(lrcPath, lrcText, "utf-8");
          this.api.log("歌词保存成功:", lrcPath);
          this.api.eventPasser.plug_emit(
            this.name,
            "music_downloader_plug_download_complete",
            { path: lrcPath }
          );
        } else {
          this.api.log(
            '\n未找到 id="content-lrc" 的元素（可能当前歌曲无歌词或页面加载异常）'
          );
        }

        this.api.log(Data);
        const playUrl = await this.play_url(Data.playid);

        if (Data.cover) {
          const coverUrl = Data.cover.startsWith("//")
            ? `https:${Data.cover}`
            : Data.cover;
          await this.downloadFile(coverUrl, Data.title, ".jpg");
        }

        await this.downloadFile(playUrl, Data.title, ".mp3");
        const safeTitle = Data.title.replace(/[\\/:*?"<>|]/g, "_");
        const jpgPath = path.join(this.Dir, `${safeTitle}.jpg`);
        const mp3Path = path.join(this.Dir, `${safeTitle}.mp3`);

        try {
          const tags = {
            title: Data.title,
            artist: Data.author,
          };

          // 如果本地封面文件存在，读取并加入 tags
          if (fs.existsSync(jpgPath)) {
            tags.image = {
              mime: "image/jpeg",
              type: { id: 3, name: "front cover" },
              description: "Cover",
              imageBuffer: fs.readFileSync(jpgPath), // 直接读取本地刚才下载的图
            };
          }

          // 写入 MP3 元数据
          const success = NodeID3.write(tags, mp3Path);

          if (success) {
            this.api.log(`元数据已成功写入本地 MP3: ${safeTitle}`);
          } else {
            this.api.log("元数据写入失败");
          }

          // 可选：如果不需要保留本地 jpg 文件，可以在此处删除
          // fs.unlinkSync(jpgPath);
        } catch (err) {
          this.api.log(`读取本地文件写入元数据出错: ${err.message}`);
        }
      } else {
        this.api.log("未找到 window.appData 数据，可能页面结构已变化");
      }
    } catch (error) {
      this.api.log(`搜索失败: ${error.message}`);
    }
  }

  async play_url(id) {
    const url = "https://www.gequbao.com/api/play-url";

    // 模拟浏览器 Headers
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://www.gequbao.com",
      Referer: "https://www.gequbao.com/",
      "X-Requested-With": "XMLHttpRequest",
    };

    // 使用 URLSearchParams 序列化 POST 数据 (对应 Python 的 data 字典)
    const params = new URLSearchParams();
    params.append("id", id);

    try {
      const response = await axios.post(url, params, {
        headers: headers,
        timeout: 15000,
      });

      if (response.status === 200) {
        // response.data 已经是自动解析后的 JSON 对象
        const json_data = response.data;

        if (json_data.data && json_data.data.url) {
          this.api.log("获取成功！播放地址:", json_data.data.url);
          return json_data.data.url;
        } else {
          this.api.log("响应成功但未找到 URL:", json_data);
          return null;
        }
      }
    } catch (error) {
      console.error(`请求失败: ${error.message}`);
      if (error.response) {
        console.error("错误详情:", error.response.data);
      }
      return null;
    }
  }

  /**
   * 下载文件到本地指定目录
   * @param {string} url 下载地址
   * @param {string} filename 文件名 (不含后缀)
   * @param {string} ext 后缀名 (需带点，例如 .mp3)
   */
  async downloadFile(url, filename, ext = "") {
    // 1. 确保目标目录存在
    if (!fs.existsSync(this.Dir)) {
      fs.mkdirSync(this.Dir, { recursive: true });
    }

    // 2. 清理文件名非法字符并拼接全路径
    const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "_");
    // 拼出完整路径：C:\Users\27576\Desktop\tmp\download\文件名.mp3
    const filePath = path.join(this.Dir, `${safeFilename}${ext}`);

    try {
      this.api.log(`开始下载: ${url} -> ${filePath}`);

      const response = await axios({
        method: "get",
        url: url,
        responseType: "stream",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Referer: "www.kuwo.cn",
        },
        timeout: 30000,
      });

      // 3. 使用 pipeline 写入文件
      await pipeline(response.data, fs.createWriteStream(filePath));

      this.api.log("下载完成:", filePath);
      this.api.eventPasser.plug_emit(
        this.name,
        "music_downloader_plug_download_complete",
        { path: filePath }
      );
      return filePath;
    } catch (error) {
      this.api.log("下载失败:", error.message);
      throw error;
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
