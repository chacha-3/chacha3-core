const http = require('http');
const WebSocket = require('ws');
const url = require('url');

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write('Hello World!2');
  res.end();
});
const wss1 = new WebSocket.Server({ noServer: true });
const wss2 = new WebSocket.Server({ noServer: true });

wss1.on('connection', (ws) => {
  // ...
});

wss2.on('connection', (ws) => {
  // ...
});

server.on('upgrade', (request, socket, head) => {
  // if (pathname === '/foo') {
  //   wss1.handleUpgrade(request, socket, head, (ws) => {
  //     wss1.emit('connection', ws, request);
  //   });
  // } else if (pathname === '/bar') {
  //   wss2.handleUpgrade(request, socket, head, (ws) => {
  //     wss2.emit('connection', ws, request);
  //   });
  // } else {
  //   socket.destroy();
  // }
});

const port = normalizePort(process.env.PORT || '8080');
server.listen(port);
