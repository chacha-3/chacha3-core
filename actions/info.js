const Chain = require('../models/chain');
const Miner = require('../models/miner');
const Peer = require('../models/peer');

const actions = {};

const miner = new Miner();

// function networkIPs() {
//   return Object.values(os.networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat((i.family === 'IPv4' && !i.internal && i.address) || []), [])), []);
// }

actions.nodeInfo = {
  permission: 'public',
  handler: async () => {
    const chain = await Chain.load();

    Peer.randomizeLocalNonce();

    const data = {
      version: process.env.npm_package_version,
      time: Date.now(),
      port: process.env.PORT || 0,
      chainLength: chain.getLength(),
      nonce: Peer.localNonce,
    };

    return { data, code: 'ok', message: 'Info' };
  },
};

// Throws an error. Used for testing error handler only
actions.teapot = {
  permission: 'public',
  handler: async () => {
    throw Error('Out of coffee');
  },
};

module.exports = actions;
