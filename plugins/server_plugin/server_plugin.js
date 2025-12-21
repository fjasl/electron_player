// plugins/server_plugin.js
const fastify = require("fastify");
const websocket = require("@fastify/websocket");
const fs = require("fs");
const pathModule = require("path"); // 重命名模块以防冲突

class ServerPlugin {
  constructor() {
    this.name = "ServerPlugin";

    this.port = 3000;
  }

  async activate(api) {
    this.api = api;
    this.server = fastify();
    try {
      this.port = this.api.statePasser.getPluginByName(this.name).port;
    } catch (e) {
      this.api.log("没有找到指定端口 默认创建3000作为端口" + e);
      this.api.statePasser.upsertPlugin({
        name: this.name,
        port: payload?.port,
      });
      this.api.storagePasser.saveState(this.api.statePasser.getState());
      this.api.log("端口成功保存");
    }
    this.api.log("服务器在" + this.port + "端口启动");
    this.api.on("server_plugin_port", (data) => {
      this.api.log(`接收到 'server_plugin_port' 意图，数据:`, data);
    });

    this.api.registerIntent("server_plugin_port", (payload, ctx) => {
      this.api.statePasser.upsertPlugin({
        name: this.name,
        port: payload?.port,
      });
      this.api.storagePasser.saveState(this.api.statePasser.getState());
      this.api.log("端口成功保存");
    });

    // >>>>> 添加 Fastify CORS 插件 <<<<<

    // 1. 注册基础支持
    await this.server.register(websocket);

    // --- 播放控制接口 /api/player ---
    this.server.register(
      async (instance) => {
        // 获取播放状态: GET /api/player/state
        instance.get("/get_state", async () => {
          return this.api.getState();
        });

        instance.post("/play", async (req, reply) => {
          this.api.statePasser.setPlaying(true);
          this.api.statePasser.snapshotLastSession();
          this.api.storagePasser.saveState(this.api.statePasser.getState());

          this.api.eventPasser.emit("play_state_changed", {
            is_playing: this.api.statePasser.get("is_playing"),
          });
          return { status: "ok" };
        });
        instance.post("/pause", async (req, reply) => {
          this.api.statePasser.setPlaying(false);
          this.api.statePasser.snapshotLastSession();
          this.api.storagePasser.saveState(this.api.statePasser.getState());

          this.api.eventPasser.emit("play_state_changed", {
            is_playing: this.api.statePasser.get("is_playing"),
          });
          return { status: "ok" };
        });
        instance.post("/play_next", async () => {
          this.api.handlersPasser.dispatch("play_next", {});
          return { status: "ok" };
        });

        instance.post("/play_prev", async () => {
          this.api.handlersPasser.dispatch("play_prev", {});
          return { status: "ok" };
        });
        instance.post("/play_at", async (req, reply) => {
          const { index } = req.body || {};
          const songList = this.api.statePasser.get("playlist") || [];
          const total = songList.length;

          if (typeof index !== "number" || index < 0 || index >= total) {
            reply.code(400);
            return {
              status: "error",
              message: `索引越界。当前列表长度为 ${total}，你发送的索引是 ${index}`,
            };
          }
          this.api.handlersPasser.dispatch("play_list_track", { index });
          return {
            status: "ok",
            msg: "开始播放第" + (index + 1).toString() + "首",
          };
        });
        instance.post("/seek", async (req, reply) => {
          const { percent } = req.body || {};
          if (typeof percent !== "number" || percent < 0 || percent > 1) {
            reply.code(400);
            return {
              error: "Invalid percent. Must be a number between 0 and 1.",
            };
          }
          this.api.handlersPasser.dispatch("seek", { percent });

          return { status: "ok", seek_to: percent };
        });
        instance.post("/set_mode", async (req, reply) => {
          const { mode } = req.body || {};
          if (mode === "single_loop") {
            this.api.statePasser.setPlayMode("single_loop");
          } else if (mode === "shuffle") {
            this.api.statePasser.setPlayMode("shuffle");
          } else {
            return {
              status: "error",
              message: `不支持的模式: '${mode}'。可选模式: "single_loop", "shuffle"`,
            };
          }
          this.api.statePasser.snapshotLastSession();
          this.api.storagePasser.saveState(this.api.statePasser.getState());

          this.api.eventPasser.emit("play_mode_changed", {
            play_mode: this.api.statePasser.get("play_mode"),
          });
          return { status: "ok", current_mode: mode };
        });
        instance.post("/set_volume", async (req, reply) => {
          const { percent } = req.body || {};

          // 1. 校验音量值是否为 0~1 的数字
          if (typeof percent !== "number" || percent < 0 || percent > 1) {
            reply.code(400);
            return {
              status: "error",
              message: "音量百分比必须是 0 到 1 之间的数字 (例如 0.5 表示 50%)",
            };
          }
          this.api.statePasser.setVolume(percent);
          this.api.eventPasser.emit("volume_changed", {
            percent: this.api.statePasser.get("volume"),
          });
          return {
            status: "ok",
            current_volume: percent,
          };
        });
      },
      { prefix: "/api/player" }
    );

    // --- 播放列表接口 /api/playlist ---
    this.server.register(
      async (instance) => {
        // 获取列表: GET /api/playlist/all
        instance.get("/all", async () => {
          return this.api.get("playlist", []);
        });
        instance.post("/del_track", async (req, reply) => {
          const { index } = req.body || {};
          const songList = this.api.statePasser.get("playlist") || [];
          const total = songList.length;

          if (typeof index !== "number" || index < 0 || index >= total) {
            reply.code(400);
            return {
              status: "error",
              message: `索引越界。当前列表长度为 ${total}，你发送的索引是 ${index}`,
            };
          }
          this.api.handlersPasser.dispatch("del_list_track", { index });
          this.api.storagePasser.saveState(this.api.statePasser.getState());
          return {
            status: "ok",
            msg: "删除了列表中第" + (index + 1).toString() + "首",
          };
        });
        instance.post("/add_track", async (req, reply) => {
          const { path } = req.body || ""; // 期望是一个路径数组
          // 1. 基本类型校验
          if (typeof path !== "string" || path.trim() === "") {
            reply.code(400);
            return { status: "error", message: "路径必须是有效的字符串" };
          }

          // 2. 音频扩展名校验 (浏览器 audio 支持的常见格式)
          const allowedExtensions = [
            ".mp3",
            ".flac",
            ".wav",
            ".m4a",
            ".aac",
            ".ogg",
            ".webm",
          ];
          const ext = pathModule.extname(path).toLowerCase();

          if (!allowedExtensions.includes(ext)) {
            reply.code(400);
            return {
              status: "error",
              message: `不支持的文件格式: ${
                ext || "无后缀"
              }。仅支持: ${allowedExtensions.join(", ")}`,
            };
          }

          // 3. 路径存在性校验 (Node.js 原生 fs 检查)
          if (!fs.existsSync(path)) {
            reply.code(404);
            return {
              status: "error",
              message: "文件路径不存在，请检查路径是否正确",
            };
          }
          const beforeList = this.api.statePasser.get("playlist") || [];
          const existingPaths = new Set(beforeList.map((t) => t.path));
          const hasDuplicate = existingPaths.has(path);
          if (hasDuplicate) {
            reply.code(409);
            return { status: "error", message: "播放列表中已存在" };
          }
          try {
            this.api.statePasser.appendToPlaylist([{ path: path }]);
            reply.code(201);
            this.api.storagePasser.saveState(this.api.statePasser.getState());

            // 7) 广播 playlist_changed（payload 中只带 playlist）
            this.api.eventPasser.emit("playlist_changed", {
              playlist: this.api.statePasser.get("playlist"),
            });
            return { status: "ok", message: "添加成功" };
          } catch (err) {
            reply.code(500);
            return { status: "error", message: "处理文件元数据时出错" };
          }
        });
      },
      { prefix: "/api/playlist" }
    );

    // --- 歌词接口 /api/lyric ---
    this.server.register(
      async (instance) => {
        // 获取当前歌词: GET /api/lyric/current
        instance.get("/current", async () => {
          return this.api.get("Lyric.LyricList", []);
        });
      },
      { prefix: "/api/lyric" }
    );

    // 3. WebSocket 接口 (保持在根或指定路径)
    this.server.get("/ws", { websocket: true }, (connection, req) => {
      connection.on("message", (message) => {
        try {
          const { intent, payload } = JSON.parse(message.toString());
          this.api.dispatch(intent, payload);
        } catch (e) {
          this.api.error("WS 消息解析错误");
        }
      });

      // >>>>> 添加这两个监听器来调试 <<<<<
      //   connection.socket.on("close", (code, reason) => {
      //     this.api.log(`WS 连接关闭。代码: ${code}, 原因: ${reason.toString()}`);
      //   });
      connection.on("close", (code, reason) => {
        this.api.log(`WS 连接关闭。代码: ${code}, 原因: ${reason.toString()}`);
      });
      //   connection.socket.on("error", (error) => {
      //     this.api.error(`WS 连接错误:`, error.message);
      //   });
      connection.on("error", (error) => {
        this.api.error(`WS 连接错误:`, error.message);
      });
    });

    // 4. 全局事件广播逻辑
    const broadcast = (payload, eventName) => {
      if (!this.server.websocketServer) return;
      this.server.websocketServer.clients.forEach((client) => {
        if (client.readyState === 1) {
          // 1 = OPEN
          client.send(JSON.stringify({ type: eventName, payload }));
        }
      });
    };

    [
      "playlist_changed",
      "current_track_changed",
      "play_mode_changed",
      "volume_changed",
    ].forEach((event) => {
      this.api.on(event, (data) => broadcast(data, event));
    });

    // 5. 启动
    try {
      await this.server.listen({ port: this.port, host: "0.0.0.0" });
      this.api.log(`多级接口服务器已启动:`);
      this.api.log(
        `- 状态查询: http://localhost:${this.port}/api/player/state`
      );
      this.api.log(
        `- 列表查询: http://localhost:${this.port}/api/playlist/all`
      );
      this.api.log(`- WebSocket: ws://localhost:${this.port}/ws`);
    } catch (err) {
      this.api.error("服务器启动失败", err);
    }
  }

  broadcastAudio(buffer) {
    // 性能优化：检查服务器和客户端是否存在
    if (!this.server?.websocketServer) {
      return;
    }
    const clients = this.server.websocketServer.clients;
    if (clients.size === 0) return;

    // 2025 性能最佳实践：直接发送二进制，binary: true 告诉 ws 库跳过 UTF-8 校验
    for (const client of clients) {
      if (client.readyState === 1) {
        // 1 为 OPEN 状态
        client.send(buffer, { binary: true });
      }
    }
  }

  async deactivate() {
    if (this.server) {
      await this.server.close();
      this.api.log("ServerPlugin已卸载并释放端口");
    }
  }
}

module.exports = ServerPlugin;
