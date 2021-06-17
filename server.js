/**
 * Normalize a port into a number, string, or false.
 */
const selfsigned = require('selfsigned');

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
  http2: true,
  https: {
    key: pems.private,
    cert: pems.cert,
  },

});

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, (err, address) => {
  console.log(address);
  if (err) {
    process.exit(1);
  }
});

module.exports = server;
