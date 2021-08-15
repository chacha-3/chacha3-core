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

  t.end();
});
