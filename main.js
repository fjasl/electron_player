// main.js （Electron 主进程入口）
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { initBackend } = require("./backend_init");

function createWindow() {
  const win = new BrowserWindow({
    width: 640,
    height: 300,
    frame: false,
    resizable: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 初始化后端状态机 + IPC
  initBackend(win);

  win.loadFile(path.join(__dirname, "index.html"));

  // 方便你看整个链路
  win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
