const debug = require('debug')('info:action');
const { version } = require('../package.json');

const Chain = require('../models/chain');
const Peer = require('../models/peer');

const { config } = require('../util/env');

const {
  errorResponse, ErrorCode, SuccessCode, okResponse,
} = require('../util/rpc');

const actions = {};

// function networkIPs() {
//   return Object.values(os.networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat((i.family === 'IPv4' && !i.internal && i.address) || []), [])), []);
// }

actions.ping = {
  permission: 'public',
  handler: () => okResponse(null, 'Pong'),
};

actions.pingNode = {
  permission: 'authOnly',
  schema: {
    properties: {
      host: { type: 'string' },
      port: { type: 'integer' },
    },
    required: ['host', 'port'],
  },
  handler: async (options) => {
    // Check if existing peer, otherwise create new
    // The reason is to maintain peers state such as peer status
    const existingPeer = await Peer.load(options.host, options.port);
    const peer = existingPeer || new Peer(options.host, options.port);

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
  handler: async (options) => {
    const chain = await Chain.load();

    debug(`Receive nodeInfo request nonce: ${options.nonce}`);

    const isSelf = options.nonce === Peer.localNonce;

    if (!isSelf) {
      Peer.randomizeLocalNonce();
    }

    const { port } = config;

    const data = {
      version,
      time: Date.now(),
      port,
      chainLength: chain.getLength(),
      chainWork: chain.getTotalWork(),
      nonce: Peer.localNonce,
    };

    return okResponse(data, 'Info');
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
