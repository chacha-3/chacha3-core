const http = require('http');
const WebSocket = require('ws');

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

const server = require('./app')({
  // logger: {
  //   level: 'info',
  //   prettyPrint: true,
  // },
});

// const start = async () => {
//   try {
//     const port = normalizePort(process.env.PORT || '3000');
//     await fastify.listen(port);
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };

// start();

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, (err, address) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }
});

module.exports = server;
