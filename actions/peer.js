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
      address: { type: 'string' },
      port: { type: 'string' },
    },
    required: ['address', 'port'],
  },
  handler: async (options) => {
    const peer = new Peer(options.address, options.port);
    const { data } = await Peer.save(peer);

    Peer.reachOut(peer);
    return okResponse(data, 'Add peer');
  },
};

actions.removePeer = {
  permission: 'authOnly',
  schema: {
    properties: {
      address: { type: 'string' },
      port: { type: 'string' },
    },
    required: ['address', 'port'],
  },
  handler: async (options) => {
    await Peer.clear(Peer.generateKey(options.address, options.port));
    return okResponse(null, 'Remove peer');
  },
};

module.exports = actions;
