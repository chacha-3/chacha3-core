const { version } = require('../package.json');

const Chain = require('../models/chain');
const Miner = require('../models/miner');
const Peer = require('../models/peer');

const { errorResponse, ErrorCode, SuccessCode, okResponse } = require('../util/rpc');

const actions = {};

const miner = new Miner();

// function networkIPs() {
//   return Object.values(os.networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat((i.family === 'IPv4' && !i.internal && i.address) || []), [])), []);
// }

actions.ping = {
  permission: 'public',
  handler: () => okResponse(null, 'Pong'),
};

actions.pingNode = {
  permission: 'public',
  schema: {
    properties: {
      address: { type: 'string' },
      port: { type: 'integer' },
    },
    required: ['address', 'port'],
  },
  handler: async (options) => {
    const peer = new Peer(options.address, options.port);
    const result = await peer.callAction('ping');

    if (result && result.code === SuccessCode) {
      const { message } = result;
      return okResponse(null, message);
    }

    return errorResponse(ErrorCode.Unavailable, 'Unavailable');
  },
};

actions.nodeInfo = {
  permission: 'public',
  handler: async () => {
    const chain = await Chain.load();

    Peer.randomizeLocalNonce();

    const data = {
      version,
      time: Date.now(),
      port: process.env.PORT || 0,
      chainLength: chain.getLength(),
      nonce: Peer.localNonce,
    };

    return okResponse(data, 'Info');
  },
};

// Throws an error. Used for testing error handler only
actions.teapot = {
  permission: 'public',
  handler: async (options) => {
    throw Error('Out of coffee');
  },
};

module.exports = actions;
