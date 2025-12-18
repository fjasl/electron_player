// metadata.js
const fs = require("fs");
const path = require("path");
const mm = require("music-metadata");

function bufferToBase64DataURI(buffer, format) {
  return `data:${format};base64,${buffer.toString("base64")}`;
}
/**
 * 解析单个文件的元数据
 * - path       : 完整路径
 * - title      : 歌名（标签里没有就用文件名）
 * - artist     : 艺术家（没有就 null）
 * - duration   : 时长（秒，解析不到时为 0）
 * - sizeBytes  : 文件大小（字节）
 */
async function extractOne(filePath) {
  let sizeBytes = 0;
  try {
    const stat = fs.statSync(filePath);
    sizeBytes = stat.size;
  } catch (e) {
    // 读不到大小就保持 0，不影响使用
  }

  try {
    const metadata = await mm.parseFile(filePath, { duration: true });
    const common = metadata.common || {};
    const format = metadata.format || {};

    const title = common.title || path.basename(filePath);
    const artist = common.artist || null;
    const duration = typeof format.duration === "number" ? format.duration : 0;

    return {
      path: filePath,
      title,
      artist,
      duration,
      sizeBytes,
    };
  } catch (e) {
    //console.warn("[metadata] parse fail:", filePath, e.message);
    // 解析失败时：至少保证有 path + 一个可展示的 title
    return {
      path: filePath,
      title: path.basename(filePath),
      artist: null,
      duration: 0,
      sizeBytes,
    };
  }
}

/**
 * 提取一组文件的元数据
 * @param {string[]} filePaths
 * @returns {Promise<Array<{ path, title, artist, duration, sizeBytes }>>}
 */
async function extractTracksMetadata(filePaths) {
  const result = [];
  for (const p of filePaths) {
    const meta = await extractOne(p);
    result.push(meta);
  }
  return result;
}

// async function extractCoverArt(filePath) {
//   try {
//     // 使用 music-metadata 解析文件，只请求图片信息可以稍微提高效率
//     const metadata = await mm.parseFile(filePath, {
//       duration: false,
//       skipCovers: false,
//     });
//     const common = metadata.common || {};

//     if (common.picture && common.picture.length > 0) {
//       const picture = common.picture[0];
//       return bufferToBase64DataURI(picture.data, picture.format);
//     }
//   } catch (e) {
//     //console.warn("[metadata] cover art parse fail:", filePath, e.message);
//   }
//   return null;
// }
async function extractCoverArt(filePath) {
  try {
    const metadata = await mm.parseFile(filePath, {
      duration: false,
      skipCovers: false,
    });
    
    const picture = metadata.common?.picture?.[0];
    if (!picture) {
      //console.log("[metadata] No picture found in:", filePath);
      return null;
    }
    
    //console.log("[metadata] Picture data type:", typeof picture.data);
    //console.log("[metadata] Picture data constructor:", picture.data?.constructor?.name);
    //console.log("[metadata] Picture format:", picture.format);
    
    // 转换数据为 Buffer
    let imageBuffer;
    if (Buffer.isBuffer(picture.data)) {
      imageBuffer = picture.data;
      //console.log("[metadata] Data is already a Buffer, length:", imageBuffer.length);
    } else if (picture.data) {
      imageBuffer = Buffer.from(picture.data);
      //console.log("[metadata] Converted to Buffer, length:", imageBuffer.length);
    } else {
      //console.log("[metadata] No data in picture");
      return null;
    }
    
    // 检查前几个字节
    if (imageBuffer.length > 0) {
      //console.log("[metadata] First few bytes:", Array.from(imageBuffer.slice(0, 10)).join(','));
    }
    
    // 获取 MIME 类型
    let mimeType = picture.format || 'image/jpeg';
    if (!mimeType.includes('/')) {
      mimeType = `image/${mimeType}`;
    }
    
    // 生成 base64
    const base64 = imageBuffer.toString('base64');
    //console.log("[metadata] Base64 preview (first 50 chars):", base64.substring(0, 50));
    
    const dataURI = `data:${mimeType};base64,${base64}`;
    
    // 验证 data URI 格式
    //console.log("[metadata] Data URI preview (first 80 chars):", dataURI.substring(0, 80));
    
    return dataURI;
  } catch (e) {
    console.warn("[metadata] cover art parse fail:", filePath, e.message);
    return null;
  }
}


module.exports = {
  extractTracksMetadata,
  extractCoverArt
};
