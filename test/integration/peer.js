const { test } = require('tap');

const Peer = require('../../models/peer');
const mock = require('../../util/mock');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

test('list all peers', async (t) => {
  const numOfPeers = 4;
  await mock.createPeers(numOfPeers);

  const { data } = await runAction({
    action: 'listPeers',
  });

  t.equal(data.length, numOfPeers);

  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'host'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'status'));

  await Peer.clearAll();

  t.end();
});

test('filter peers by status', async (t) => {
  await mock.createPeers(4);

  const status = [
    Peer.Status.Active,
    Peer.Status.Inactive,
    Peer.Status.Unreachable,
    Peer.Status.Idle,
  ];

  const peerList = await Peer.all();
  t.equal(peerList.length, 4);

  for (let i = 0; i < status.length; i += 1) {
    const peer = peerList[i];
    peer.setStatus(status[i]);
    await peer.save();
  }

  const { data } = await runAction({
    action: 'listPeers',
    status: `${Peer.Status.Active}|${Peer.Status.Inactive}`,
  });

  t.equal(data.length, 2);

  for (let j = 0; j < data.length; j += 1) {
    t.ok(data[j].status === Peer.Status.Active || data[j].status === Peer.Status.Inactive);
  }

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
