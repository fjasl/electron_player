const fs = require("fs").promises;
const path = require("path");

/**
 * LrcParser 模块：用于解析LRC歌词和根据时间查找歌词。
 */
const LrcParser = (function () {
  let list = []; // 使用 let 代替隐式全局变量

  /**
   * 将 LRC 时间戳字符串（MM:SS.mmm 或 MM:SS）转换为带有毫秒精度的秒数。
   * @param {string} timestamp e.g., "02:30.123"
   * @returns {number} 带有毫秒的秒数，如果格式无效则返回 NaN
   */
  function timeToSeconds(timestamp) {
    const parts = timestamp.split(":");
    if (parts.length !== 2) {
      return NaN;
    }

    const minutes = parseInt(parts[0], 10);
    const secondsParts = parts[1].split(".");
    const seconds = parseInt(secondsParts[0], 10);
    const milliseconds = secondsParts[1] ? parseInt(secondsParts[1], 10) : 0;

    if (isNaN(minutes) || isNaN(seconds)) {
      return NaN;
    }

    // 返回总秒数，包含毫秒部分
    return minutes * 60 + seconds + milliseconds / 1000;
  }

  /**
   * 根据当前时间查找最匹配的歌词索引。
   * 此函数现在使用带毫秒的秒进行比较。
   * @param {number} currentTimeInSeconds 当前播放时间的带毫秒的秒数
   * @returns {number} 匹配到的歌词索引
   */
  function findLyricByTime(currentTimeInSeconds) {
    if (list.length === 0) return 0; // 返回默认索引 0
    let index = 0;
    for (let i = 0; i < list.length; i++) {
      // 使用 <= 进行带毫秒的秒数比较
      if (list[i].time <= currentTimeInSeconds) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }

  /**
   * 读取指定路径的LRC文件并解析。
   * @param {string} filePath LRC文件的完整路径。
   * @returns {Promise<Array<{time: number, text: string}>>} 解析后的歌词数组的 Promise。
   */
  async function loadAndParseLrcFile(filePath) {
    try {
      const lrcContent = await fs.readFile(filePath, "utf-8");

      const lines = lrcContent.split("\n");
      const lyrics = [];

      // 正则表达式依然捕获所有时间格式，但在 timeToSeconds 中处理为带毫秒的秒
      const lineRegex = /^\[(\d{2}:\d{2}(?:\.\d{1,3})?)\](.*)/;

      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        let match = trimmedLine.match(lineRegex);

        if (match) {
          const timestamp = match[1];
          const text = match[2].trim(); 

          // 此处调用 timeToSeconds，返回的是带毫秒的秒数
          const timeInSecondsValue = timeToSeconds(timestamp); 

          if (!isNaN(timeInSecondsValue) && text) {
            lyrics.push({
              time: timeInSecondsValue,
              text: text,
            });
          }
        }
      });

      // 过滤掉时间为 0 且文本为空的行（元数据行通常时间为 0 但有文本，我们保留它们）
      const filteredLyrics = lyrics.filter(item => item.text.length > 0);

      // 按照时间戳（带毫秒精度的秒数）排序
      filteredLyrics.sort((a, b) => a.time - b.time);

      list = filteredLyrics; // 更新模块内部的 list 变量
      return filteredLyrics;
      
    } catch (error) {
      console.error("加载或解析LRC文件时出错:", error);
      list = [];
      throw error;
    }
  }

  // 暴露公共方法
  return {
    loadAndParseLrcFile,
    findLyricByTime,
    getParsedLyrics: () => list,
  };
})();

// 导出模块（适用于 Node.js/CommonJS 环境）
module.exports = LrcParser;
