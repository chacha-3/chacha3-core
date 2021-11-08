const assert = require('assert');
const mock = require('../../util/mock');
const { SuccessCode } = require('../../util/rpc');

// const actions = [];
// const defaultParams = { host: '127.0.0.1', port: 7000 };

// actions.listPeers = {
//   params: defaultParams,
//   handler: async () => {
//     const peers = await Peer.all();
//     const data = peers.map((peer) => peer.toObject());

//     return { data, code: SuccessCode, message: 'Peer list' };
//   },
// };

// Host: 127.0.0.1, port: 7000
const peer7000Actions = {};

peer7000Actions.listPeers = async () => {
  const peers = [mock.nodePeer(), mock.nodePeer(), mock.nodePeer()];
  const data = peers.map((peer) => peer.toObject());

  return { data, code: SuccessCode, message: 'Peer list' };
};

const mapHandler = async (host, port, options) => {
  // Only single host and port test for now
  if (host !== '127.0.0.1' || port !== 7000) {
    assert(false);
  }

  const { action } = options;

  if (!action) {
    return null;
  }

  // TODO: Other ports
  const response = await peer7000Actions[action](options);
  return response;
};

const mockAction = async (host, port, options) => {
  const response = await mapHandler(host, port, options);
  assert(response !== null);

  if (response) {
    return JSON.stringify(response);
  }

  return null;
};

module.exports = mockAction;
