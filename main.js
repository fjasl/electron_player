// main.js （Electron 主进程入口）
const { app, BrowserWindow, Tray, Menu, shell } = require("electron");
const path = require("path");
const { initBackend } = require("./backend_init");

const storage = require("./units/storage");

let win = null;
let stateStoreInstance = null;

function createWindow() {
  win = new BrowserWindow({
    width: 640,
    height: 300,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 初始化后端状态机 + IPC

  win.loadFile(path.join(app.getAppPath(), "index.html"));

  // 方便你看整个链路
  //win.webContents.openDevTools({ mode: "detach" });
}

function createTray() {
  // 确保您有一个图标文件。这里使用一个 Electron 默认的图标作为示例。
  // 您应该替换为您自己的应用图标路径，例如 './assets/icon.png'
  const iconPath = path.join(app.getAppPath(), "icon.png");

  appIcon = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示/隐藏",
      click: () => {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "开发者工具", // 添加新的菜单项
      click: () => {
        if (win.webContents.isDevToolsOpened()) {
          // 如果已经打开了，就关闭它
          win.webContents.closeDevTools();
        } else {
          // 如果是关闭状态，就以 'detach' 模式打开
          win.webContents.openDevTools({ mode: "detach" });
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "联系作者",
      click: async () => {
        // 使用 shell 打开外部链接
        const githubUrl = "https://space.bilibili.com/636291411"; // 替换为您的联系方式链接
        await shell.openExternal(githubUrl);
      },
    },
    {
      type: "separator", // 添加分割线
    },
    {
      label: "退出",
      click: () => {
        app.quit(); // 退出应用
      },
    },
  ]);

  appIcon.setToolTip("yun_player"); // 设置鼠标悬停时的提示文本
  appIcon.setContextMenu(contextMenu);

  // 可选：点击托盘图标时显示窗口
  appIcon.on("click", () => {
    win.isVisible() ? win.hide() : win.show();
  });
}

app.whenReady().then(async () => {
  // 获取 asar 文件的父目录路径 (即 win-unpacked 目录)
  createWindow();
  // 在 main.js 创建窗口后立即调用
  win.setIgnoreMouseEvents(false);

  createTray();
  stateStoreInstance = await initBackend(win);
});

// app.on("window-all-closed", () => {
//   app.quit();
// });

app.on("will-quit", () => {
  // console.log("应用即将退出，正在保存状态...");
  if (stateStoreInstance) {
    storage.saveState(stateStoreInstance.getState());
    // console.log("状态保存完毕。");
  } else {
    // console.warn("未找到 stateStore 实例，无法保存状态。");
  }
});
