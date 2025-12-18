// 发送 intent 给主进程
function sendIntent(intent, payload = {}) {
  ipcRenderer.send("frontend-intent", { intent, payload });
}

// 从路径里取文件名用于展示
function titleFromPath(p) {
  if (!p) return "未知标题";
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

// 使用 module.exports 暴露函数给其他文件
window.sendIntent = sendIntent;
window.titleFromPath = titleFromPath;

