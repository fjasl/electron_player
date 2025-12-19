// plugins/server_plugin.js
const fastify = require('fastify');
const websocket = require('@fastify/websocket');

class ServerPlugin {
  constructor() {
    this.name = 'ServerPlugin';
    this.port = 3000;
  }

  async activate(api) {
    this.api = api;
    this.server = fastify();

    // 注册 WebSocket 支持
    await this.server.register(websocket);

    // HTTP 接口
    this.server.get('/state', (req, reply) => {
      reply.send(this.api.getState());
    });

    // WebSocket 接口
    this.server.get('/*', { websocket: true }, (connection, req) => {
      connection.socket.send(JSON.stringify({ type: 'init', payload: this.api.getState() }));
      
      connection.socket.on('message', message => {
        try {
          const { intent, payload } = JSON.parse(message.toString());
          this.api.dispatch(intent, payload);
        } catch (e) {}
      });
    });

    // 事件转发
    const handler = (payload, eventName) => {
      this.server.websocketServer.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: eventName, payload }));
        }
      });
    };

    ['playlist_changed', 'current_track_changed'].forEach(event => {
      this.api.on(event, (data) => handler(data, event));
    });

    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      this.api.log(`服务器已启动: http://localhost:${this.port}`);
    } catch (err) {
      this.api.error('启动失败', err);
    }
  }

  async deactivate() {
    if (this.server) {
      await this.server.close();
      this.api.log('服务器已关闭');
    }
  }
}

module.exports = ServerPlugin;
