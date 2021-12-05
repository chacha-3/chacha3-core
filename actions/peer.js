const Peer = require('../models/peer');
const { okResponse } = require('../util/rpc');

const actions = {};

const optionFilter = (opts, field) => (obj) => {
  if (!opts[field]) {
    return true;
  }

  const filterString = opts[field].split('|');
  return filterString.includes(obj[field]);
};

actions.listPeers = {
  permission: 'public',
  schema: {
    properties: {
      status: { type: 'string' },
    },
  },
  handler: async (options) => {
    const peers = await Peer.all();
    const data = peers
      .filter(optionFilter(options, 'status'))
      .map((peer) => peer.toObject());

    return { data, code: 'ok', message: 'Peer list' };
  },
};

actions.addPeer = {
  permission: 'authOnly',
  schema: {
    properties: {
      host: { type: 'string' },
      port: { type: 'string' },
    },
    required: ['host', 'port'],
  },
  handler: async (options) => {
    const peer = new Peer(options.host, options.port);
    await peer.save();

    // TODO: Test
    peer.reachOut();

    return okResponse(peer.toObject(), 'Add peer');
  },
};

actions.removePeer = {
  permission: 'authOnly',
  schema: {
    properties: {
      host: { type: 'string' },
      port: { type: 'string' },
    },
    required: ['host', 'port'],
  },
  handler: async (options) => {
    await Peer.clear(Peer.generateKey(options.host, options.port));
    return okResponse(null, 'Remove peer');
  },
};

module.exports = actions;
