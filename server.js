/**
 * Normalize a port into a number, string, or false.
 */
const pem = require('pem');

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
  // http2: true,
  // https: {
  //   key: fs.readFileSync(path.join(__dirname, '..', 'https', 'fastify.key')),
  //   cert: fs.readFileSync(path.join(__dirname, '..', 'https', 'fastify.cert'))
  // }
});

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, (err, address) => {
  console.log(address);
  if (err) {
    process.exit(1);
  }
});

module.exports = server;
