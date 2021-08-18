require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const debug = require('debug')('main');
const server = require('./server');
const ipc = require('./ipc');

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

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, async (err) => {
  debug(`Server listening on port ${port}`);
  if (err) {
    // Block.clearAll();
    process.exit(1);
  }
});

ipc.server.start();
