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

test('peer is self when matching nonce', (t) => {
  const peer = new Peer('192.168.1.1', 8888);

  peer.setNonce(Peer.myNonce);
  t.equal(peer.isSelf(), true);

  peer.setNonce(Peer.myNonce + 1);
  t.equal(peer.isSelf(), false);

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

  const { key, data } = await Peer.save(peer);

  t.ok(key.equals(peer.getId()));

  const loaded = await Peer.load(key);

  t.equal(data.version, loaded.getVersion());
  t.equal(data.chainLength, loaded.getChainLength());
  t.equal(data.address, loaded.getAddress());
  t.equal(data.port, loaded.getPort());

  Peer.clear(key);
  t.end();
});

test('load peer list', async (t) => {
  const emptyList = await Peer.all();
  t.equal(emptyList.length, 0);

  const numOfPeers = 3;
  await mock.createPeers(numOfPeers);

  const list = await Peer.all();
  t.equal(list.length, numOfPeers);

  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'address'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'chainLength'));

  Peer.clearAll();
  t.end();
});
