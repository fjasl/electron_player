const http = require('http');
const WebSocket = require('ws');
const url = require('url');

class ServerPlugin {
  constructor() {
    this.name = 'ServerPlugin';
    this.port = 3000;
    this.clients = new Set();
    this.server = null;
    this.wss = null;
  }

  activate(api) {
    this.api = api;

    this.server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;

      // 统一跨域处理
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      if (req.method === 'GET') {
        if (pathname === '/state') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(this.api.getState()));
        } 
        if (pathname === '/playlist') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(this.api.get('playlist', [])));
        }
      } 
      
      if (req.method === 'POST' && pathname === '/intent') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { intent, payload = {} } = JSON.parse(body);
            // 【改进】：直接使用 api 暴露的 dispatch，不再 require 外部
            this.api.dispatch(intent, payload); 
            res.writeHead(200);
            res.end('OK');
          } catch (e) {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'init', payload: this.api.getState() }));

      ws.on('message', (message) => {
        try {
          const { intent, payload = {} } = JSON.parse(message.toString());
          this.api.dispatch(intent, payload);
        } catch (e) {
          this.api.error('WebSocket 消息解析失败');
        }
      });

      ws.on('close', () => this.clients.delete(ws));
    });

    this.server.listen(this.port, () => {
      this.api.log(`HTTP & WebSocket Server 运行在端口: ${this.port}`);
    });

    // 事件转发
    const events = ['playlist_changed', 'current_track_changed', 'play_mode_changed', 'volume_changed'];
    events.forEach(event => {
      this.api.on(event, (payload) => this.broadcast(event, payload));
    });
  }

  broadcast(event, payload) {
    const msg = JSON.stringify({ type: event, payload });
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }

  deactivate() {
    // 【关键】：必须关闭所有连接和服务器，否则热重载会端口冲突
    this.clients.forEach(ws => ws.terminate());
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
    this.api?.log('ServerPlugin 已彻底释放资源');
  }
}

module.exports = ServerPlugin;
