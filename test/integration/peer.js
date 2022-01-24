const bent = require('bent');
const { test } = require('tap');

const Peer = require('../../models/peer');
const Chain = require('../../models/chain');
const mock = require('../../util/mock');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

const build = require('../../app');
const { HOST_127_0_0_100, PORT_7000 } = require('../../util/peer-response');
const { randomNumberBetween } = require('../../util/math');
const { waitUntil } = require('../../util/sync');

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
    port: 5438,
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

test('sync if request comes from a peer with longer chain', (t) => {
  const app = build();

  t.teardown(() => app.close());

  app.listen(0, async (err) => {
    t.error(err);

    t.equal((await Peer.all()).length, 0);
    t.equal(Chain.mainChain.getLength(), 1);
    t.equal(Chain.mainChain.getTotalWork(), 1);

    const { port } = app.server.address();

    // Header of the request from the longer peer
    const header = {
      [Peer.RequestHeader.Host]: HOST_127_0_0_100,
      [Peer.RequestHeader.Port]: PORT_7000,
      [Peer.RequestHeader.ChainLength]: 9,
      [Peer.RequestHeader.ChainWork]: 9,
      // [Peer.RequestHeader.Version]: version, // TODO:
    };

    const post = bent(`http://127.0.0.1:${port}`, 'POST', 'json', 200, header);
    await post('', { action: 'nodeInfo', nonce: randomNumberBetween(1, 1000000000) });

    // Has one peer before reaching out to sync with other peers
    t.equal((await Peer.all()).length, 1);

    // Wait for sync before clearing peers
    await waitUntil(async () => (await Peer.all()).length > 1);
    await waitUntil(() => Chain.mainChain.getLength() > 1);

    t.equal(Chain.mainChain.getLength(), 8);

    await Peer.clearAll();
    await Chain.clearMain();

    t.end();
  });
});
