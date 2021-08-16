require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const debug = require('debug')('server');
const selfsigned = require('selfsigned');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Block = require('./models/block');
const Chain = require('./models/chain');
const Peer = require('./models/peer');

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

const attrs = [{ name: 'commonName', value: 'bong' }];

const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  days: 530,
  algorithm: 'sha256',
});

const server = require('./app')({
  // logger: {
  //   level: 'info',
  //   prettyPrint: true,
  // },
  http2: false,
  https: {
    key: pems.private,
    cert: pems.cert,
  },
});

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, async (err, address) => {
  debug(`Server listening on port ${port}`);
  if (err) {
    // Block.clearAll();
    process.exit(1);
  }
});

ipc.server.start();

module.exports = server;
