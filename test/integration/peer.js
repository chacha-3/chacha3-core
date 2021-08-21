const { test } = require('tap');

const Peer = require('../../models/peer');
const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

const { runAction } = require('../../actions');

// const build = require('../../app');
const server = require('../../server');

test('list all peers', async (t) => {
  await mock.createPeers(2);

  const { data } = await runAction({
    action: 'listPeers',
  });

  t.equal(data.length, 2);

  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'address'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'status'));

  await Peer.clearAll();

  t.end();
});

test('remove a saved peer', async (t) => {
  const peer = mock.nodePeer();
  await Peer.save(peer);

  const { data } = await runAction({
    action: 'removePeer',
    address: peer.getAddress(),
    port: peer.getPort(),
  });

  await Peer.clearAll();

  t.end();
});
