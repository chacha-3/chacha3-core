const { test } = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Peer = require('../../models/peer');

const mock = require('../../util/mock');

// const { expect } = chai;
// chai.use(dirtyChai);

test('should create a peer', (t) => {
  const peer = new Peer('192.168.1.1', 8888);

  t.equal(peer.getAddress(), '192.168.1.1');
  t.equal(peer.getPort(), 8888);

  t.end();
});

test('peer have correct key', (t) => {
  const peer = new Peer('192.168.1.1', 8888);
  const result = Buffer.from([192, 168, 1, 1, 0x22, 0xb8]);

  t.ok(peer.getId().equals(result));
  t.end();
});

// test('peer is self when matching nonce', (t) => {
//   const peer = new Peer('192.168.1.1', 8888);

//   // t.equal(peer.isSelf(), true);

//   // t.equal(peer.isSelf(), false);

//   t.end();
// });

test('peer nonce generate', (t) => {
  // const peer = new Peer('192.168.1.1', 8888);

  const initial = Peer.localNonce;
  t.equal(initial, 0);

  Peer.randomizeLocalNonce();

  const regenerated = Peer.localNonce;

  t.not(initial, regenerated);

  t.end();
});

test('peer check compatibility', (t) => {
  const peer = new Peer('192.168.1.1', 8888);

  peer.setVersion('0.0.1');
  t.equal(peer.isCompatible(), true);

  peer.setVersion('0.0.0');
  t.equal(peer.isCompatible(), false);

  t.end();
});

test('save and load peer', async (t) => {
  const peer = mock.nodePeer();
  await peer.save();

  // t.ok(key.equals(peer.getId()));

  const loaded = await Peer.load(peer.getId());

  t.equal(peer.getVersion(), loaded.getVersion());
  t.equal(peer.getChainLength(), loaded.getChainLength());
  t.equal(peer.getAddress(), loaded.getAddress());
  t.equal(peer.getPort(), loaded.getPort());
  t.equal(peer.getStatus(), loaded.getStatus());

  await Peer.clear(peer.getId());
  t.end();
});

test('load peer list', async (t) => {
  const emptyList = await Peer.all();
  t.equal(emptyList.length, 0);

  const numOfPeers = 3;
  await mock.createPeers(numOfPeers);

  const list = await Peer.all();
  t.equal(list.length, numOfPeers);

  // TODO: Check loaded value matches

  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'address'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'status'));

  t.equal(typeof (list[0].port), 'number');
  t.equal(typeof (list[0].chainLength), 'number');

  await Peer.clearAll();
  t.end();
});

test('get peer with most total work', async (t) => {
  const work = [2, 8, 3, 10, 4];

  for (let i = 0; i < work.length; i += 1) {
    const peer = mock.nodePeer();
    peer.setTotalWork(work[i]);
    peer.setStatus(Peer.Status.Active);
    await peer.save();
  }

  const peerPriority = await Peer.withLongestActiveChains();

  t.equal(peerPriority[0].getTotalWork(), 10);
  t.equal(peerPriority[1].getTotalWork(), 8);
  t.equal(peerPriority[2].getTotalWork(), 4);
  t.equal(peerPriority[3].getTotalWork(), 3);
  t.equal(peerPriority[4].getTotalWork(), 2);

  await Peer.clearAll();
  t.end();
});

test('list of seed peers', async (t) => {
  const list = Peer.SeedList;

  t.ok(list.length > 0);

  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'address'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'port'));

  t.end();
});

test('to and from object', async (t) => {
  const peer = mock.nodePeer();

  const obj = peer.toObject();

  const loaded = Peer.fromObject(obj);

  t.equal(peer.getVersion(), loaded.getVersion());
  t.equal(peer.getChainLength(), loaded.getChainLength());
  t.equal(peer.getAddress(), loaded.getAddress());
  t.equal(peer.getPort(), loaded.getPort());
  t.equal(peer.getStatus(), loaded.getStatus());

  t.end();
});
