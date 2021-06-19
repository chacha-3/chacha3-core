const WebSocket = require('ws');

const ws = new WebSocket('wss://localhost:3000', { rejectUnauthorized: false });

ws.on('open', function open() {
  ws.send({"action": "handshake", "version": 1});
});

ws.on('message', function incoming(data) {
  console.log(data);
});

ws.on('error', function incoming(data) {
  console.log(data);
});