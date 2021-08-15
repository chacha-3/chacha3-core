const { test } = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Peer = require('../../models/peer');

const mock = require('../../util/mock');

// const { expect } = chai;
// chai.use(dirtyChai);

test('should create a peer', (t) => {
  const peer = new Peer();
  peer.setAddress('192.168.1.1');
  peer.setPort(8888);

  t.end();
});

test('peer have correct key', (t) => {
  const peer = new Peer();
  peer.setAddress('192.168.1.1');
  peer.setPort(8888);

  const result = Buffer.from([192, 168, 1, 1, 0x22, 0xb8]);
  t.ok(peer.getId().equals(result));

  t.end();
});

test('save and load peer', async (t) => {
  const peer = mock.nodePeer();

  const { key, data } = await Peer.save(peer);

  t.ok(key.equals(peer.getId()));

  t.equal(data.version, peer.getVersion());
  t.equal(data.chainLength, peer.getChainLength());
  t.equal(data.address, peer.getAddress());
  t.equal(data.port, peer.getPort());

  t.end();
});
