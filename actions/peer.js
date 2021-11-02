const Peer = require('../models/peer');
const { okResponse } = require('../util/rpc');

const actions = {};

actions.listPeers = {
  permission: 'public', // TODO: Change to private
  handler: async () => {
    const peers = await Peer.all();
    const data = peers.map((peer) => peer.toObject());

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
