// 确保您的环境支持 Node.js 的 fs 模块
const fs = require("fs").promises;
const path = require("path");

/**
 * LrcParser 模块：用于解析LRC歌词和根据时间查找歌词。
 */
const LrcParser = (function () {
  list = [];

  // ... （timeToSeconds 和 findLyricByTime 函数保持不变）...
  function timeToSeconds(timestamp) {
    // 使用 split 来确保正确分离分钟和秒
    const parts = timestamp.split(":");
    if (parts.length !== 2) {
      return NaN;
    }

    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]); // 使用 parseFloat 处理小数秒

    if (isNaN(minutes) || isNaN(seconds)) {
      return NaN;
    }

    return minutes * 60 + seconds;
  }

  function findLyricByTime(currentTimeInSeconds) {
    if (list.length === 0) return "";
    let index = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].time <= currentTimeInSeconds) {
        bestMatchText = list[i].text;
        index = i;
      } else {
        break;
      }
    }
    return index;
  }

  // 核心修改在这里：一个新的异步方法来读取和解析文件
  /**
   * 读取指定路径的LRC文件并解析。
   * @param {string} filePath LRC文件的完整路径。
   * @returns {Promise<Array<{time: number, text: string}>>} 解析后的歌词数组的 Promise。
   */
  async function loadAndParseLrcFile(filePath) {
    // 假设 fs 模块已经导入: const fs = require('fs').promises;
    // 如果在浏览器环境，需要使用 fetch API 等替代 fs.readFile
    try {
      // 使用 Node.js fs/promises 模块异步读取文件内容
      const lrcContent = await fs.readFile(filePath, "utf-8");

      const lines = lrcContent.split("\n");
      const lyrics = [];

      // 更精确地匹配时间标签：[MM:SS.mmm] 或 [MM:SS]
      const lineRegex = /^\[(\d{2}:\d{2}(?:\.\d{1,3})?)\](.*)/;

      lines.forEach((line) => {
        // 使用 trim() 清除行首尾空格，防止正则匹配失败
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        let match = trimmedLine.match(lineRegex);

        if (match) {
          // 如果一行只包含一个时间戳（例如 [00:01.46]风紧紧追着雨）
          const timestamp = match[1];
          const text = match[2].trim(); // 文本在第二个捕获组，需要 trim

          const timeInSecondsValue = timeToSeconds(timestamp);

          if (!isNaN(timeInSecondsValue) && text) {
            lyrics.push({
              time: timeInSecondsValue,
              text: text,
            });
          }
        } else {
          // 处理一行有多个时间戳的情况，或者信息标签（如 [ar:艺人]）
          // 您目前的解析方法主要针对单时间戳行，如果需要更复杂的解析，可以进一步优化
          // 对于您提供的示例歌词，原逻辑尝试处理一行多个时间戳的方式是可行的，
          // 但原逻辑会提取空文本给信息标签，导致大量 time: 0 的条目。
          // 改进后的正则 lineRegex 避免了这个问题。
        }
      });

      // 过滤掉时间为 0 的信息行（如出品人信息），只保留有内容的歌词行
      const filteredLyrics = lyrics.filter(
        (item) => item.time > 0 || item.text
      );

      // 按照时间戳排序
      filteredLyrics.sort((a, b) => a.time - b.time);

      // list = filteredLyrics; // 如果 list 是一个外部变量
      return filteredLyrics;
    } catch (error) {
      console.error("加载或解析LRC文件时出错:", error);
      // list = [];
      throw error; // 抛出错误以便调用方处理
    }
  }
  // 暴露公共方法
  return {
    loadAndParseLrcFile, // 新增的异步加载方法
    findLyricByTime,
    getParsedLyrics: () => list,
  };
})();

// 导出模块（适用于 Node.js/CommonJS 环境）
module.exports = LrcParser;
