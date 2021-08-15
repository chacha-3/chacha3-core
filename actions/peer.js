// const bs58 = require('bs58');
// const { option } = require('yargs');

const Peer = require('../models/peer');

const actions = {};

actions.peerList = {
  permission: 'public', // TODO: Change to private
  handler: async () => {
    const peers = await Peer.all();
    const data = peers.map((peer) => peer.toObject());

    return { data, code: 'ok', message: 'Peer list' };
  },
};

actions.addPeer = {
  permission: 'authOnly', // TODO: Change to private
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

    Peer.reactOut(peer);

    return { data, code: 'ok', message: 'Add peer' };
  },
};

module.exports = actions;
