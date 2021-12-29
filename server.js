const debug = require('debug')('server');
const selfsigned = require('selfsigned');

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const attrs = [{ name: 'commonName', value: 'chacha3' }];

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
  // http2: false,
  // https: {
  //   key: pems.private,
  //   cert: pems.cert,
  // },
});

module.exports = server;
