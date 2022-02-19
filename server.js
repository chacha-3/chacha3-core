const server = require('./app')({
  // logger: {
  //   level: 'info',
  //   prettyPrint: true,
  // },
  // http2: false,
  // https: {
  //   key: pems.private,
  //   cert: pems.cert,
  // },
});

module.exports = server;
