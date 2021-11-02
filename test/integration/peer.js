const { test } = require('tap');

const Peer = require('../../models/peer');
const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

test('list all peers', async (t) => {
  await mock.createPeers(2);

  const { data } = await runAction({
    action: 'listPeers',
  });

  t.equal(data.length, 2);

  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'host'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'status'));

  await Peer.clearAll();

  t.end();
});

test('add a peer', async (t) => {
  await mock.createPeers(2);

  const { code, data } = await runAction({
    action: 'addPeer',
    host: '127.0.0.1',
    port: 3000,
  });

  t.equal(code, SuccessCode);

  t.ok(Object.prototype.hasOwnProperty.call(data, 'host'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'port'));

  await Peer.clearAll();

  t.end();
});

test('remove a saved peer', async (t) => {
  const peer = mock.nodePeer();
  await peer.save();

  const { data } = await runAction({
    action: 'removePeer',
    host: peer.getHost(),
    port: peer.getPort(),
  });

  await Peer.clearAll();

  t.end();
});
