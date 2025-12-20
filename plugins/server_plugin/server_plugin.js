// plugins/server_plugin.js
const fastify = require("fastify");
const websocket = require("@fastify/websocket");

class ServerPlugin {
  constructor() {
    this.name = "ServerPlugin";

    this.port = 3000;
  }

  async activate(api) {
    this.api = api;
    this.server = fastify();
    try{
      this.port = this.api.statePasser.getPluginByName(this.name).port;
    }
    catch(e){
      this.api.log("没有找到指定端口 默认创建3000作为端口"+e);
      this.api.statePasser.upsertPlugin({ name: this.name, port: payload?.port });
      this.api.storagePasser.saveState(this.api.statePasser.getState());
      this.api.log("端口成功保存");

    }
    this.api.log("服务器在"+this.port+"端口启动");
    this.api.on("server_plugin_port", (data) => {
      this.api.log(`接收到 'server_plugin_port' 意图，数据:`, data);
    });

    this.api.registerIntent("server_plugin_port", (payload, ctx) => {
      this.api.statePasser.upsertPlugin({ name: this.name, port: payload?.port });
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
        instance.get("/state", async () => {
          return this.api.getState();
        });

        // 发送播放意图: POST /api/player/intent
        instance.post("/intent", async (req, reply) => {
          const { intent, payload } = req.body;
          this.api.dispatch(intent, payload);
          return { status: "ok" };
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
