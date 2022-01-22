const { test } = require('tap');
const Chain = require('../../models/chain');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Peer = require('../../models/peer');

const mock = require('../../util/mock');
const { SuccessCode } = require('../../util/rpc');
const {
  HOST_127_0_0_99,
  HOST_127_0_0_100,
  HOST_127_0_0_101,
  HOST_127_0_0_200,
  PORT_7000,
  headers,
} = require('../../util/peer-response');

const blockData = require('../../util/mock/data/blocks.json');
const Transaction = require('../../models/transaction');

// const { expect } = chai;
// chai.use(dirtyChai);

test('should create a peer', (t) => {
  const peer = new Peer('192.168.1.1', 8888);

  t.equal(peer.getHost(), '192.168.1.1');
  t.equal(peer.getPort(), 8888);

  t.end();
});

test('set peer valid port', async (t) => {
  const peer = new Peer('127.0.0.1', 2000);
  peer.setPort(5000);

  t.equal(peer.getPort(), 5000);

  t.end();
});

// // TODO:
// // test('set peer invalid port', async (t) => {
// //   const peer = new Peer('127.0.0.1', 0);
// //   t.err(peer.setPort(1000));
// //   // t.equal(peer.getPort(), 5000);

// //   t.end();
// // });

test('peer have correct key', (t) => {
  const peer = new Peer('192.168.1.1', 8888);
  const result = Buffer.from([0xc5, 0xd9, 0x93, 0x2e, 0x58, 0x9e, 0x84, 0x8e]);

  t.ok(peer.getId().equals(result));
  t.end();
});

// // test('peer is self when matching nonce', (t) => {
// //   const peer = new Peer('192.168.1.1', 8888);

// //   // t.equal(peer.isSelf(), true);

// //   // t.equal(peer.isSelf(), false);

// //   t.end();
// // });

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

  const loaded = await Peer.load(peer.getHost(), peer.getPort());

  t.equal(peer.getVersion(), loaded.getVersion());
  t.equal(peer.getChainLength(), loaded.getChainLength());
  t.equal(peer.getHost(), loaded.getHost());
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
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'host'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'status'));

  t.equal(typeof (list[0].port), 'number');
  t.equal(typeof (list[0].chainLength), 'number');

  await Peer.clearAll();
  t.end();
});

test('load active peers', async (t) => {
  const activePeer1 = new Peer(HOST_127_0_0_100, PORT_7000);
  activePeer1.setStatus(Peer.Status.Active);

  const activePeer2 = new Peer(HOST_127_0_0_99, PORT_7000);
  activePeer2.setStatus(Peer.Status.Active);

  const inactivePeer = new Peer(HOST_127_0_0_101, PORT_7000);
  inactivePeer.setStatus(Peer.Status.Inactive);

  await activePeer1.save();
  await activePeer2.save();
  await inactivePeer.save();

  const activePeers = await Peer.activeList();
  t.equal(activePeers.length, 2);

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

  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'host'));
  t.ok(Object.prototype.hasOwnProperty.call(list[0], 'port'));

  t.end();
});

test('to and from object', async (t) => {
  const peer = mock.nodePeer();

  const obj = peer.toObject();

  const loaded = Peer.fromObject(obj);

  t.equal(peer.getVersion(), loaded.getVersion());
  t.equal(peer.getChainLength(), loaded.getChainLength());
  t.equal(peer.getHost(), loaded.getHost());
  t.equal(peer.getPort(), loaded.getPort());
  t.equal(peer.getStatus(), loaded.getStatus());

  t.end();
});

test('update peer chain info', async (t) => {
  const chainLength = 4;

  const chain = await mock.chainWithHeaders(chainLength, 4);
  const peer = mock.nodePeer();
  peer.updateChainInfo(chain);

  t.equal(peer.getChainLength(), chainLength);
  t.equal(peer.getTotalWork(), chain.getTotalWork());

  t.end();
});

test('set peer info', async (t) => {
  const peer = new Peer('127.0.0.1', 3002);
  peer.setPeerInfo('2.0.0', 10, 100);

  t.equal(peer.getVersion(), '2.0.0');
  t.equal(peer.getChainLength(), 10);
  t.equal(peer.getTotalWork(), 100);

  t.end();
});

test('peer equality check', async (t) => {
  const peer = new Peer('127.0.0.1', 3000);
  const samePeer = new Peer('127.0.0.1', 3000);

  const differentPort = new Peer('127.0.0.1', 5000);
  const differentHost = new Peer('127.0.0.2', 3000);

  t.ok(Peer.areSame(peer, samePeer));
  t.not(Peer.areSame(peer, differentPort));
  t.not(Peer.areSame(peer, differentHost));

  t.end();
});

test('send request to another peer', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);

  const response = await peer.sendRequest({ action: 'nodeInfo' });

  t.equal(response.code, SuccessCode);
  t.end();
});

// test('sync with peer list from another peer', async (t) => {
//   const peer = new Peer(HOST_127_0_0_100, PORT_7000);

//   const currentPeers = await Peer.all();
//   t.equal(currentPeers.length, 0);

//   const result = await peer.syncPeerList();
//   t.equal(result, true);

//   const updatedPeers = await Peer.all();
//   t.equal(updatedPeers.length, 3); // Only peers with status of 'active' and 'inactive'
//   t.equal(updatedPeers[0].status, Peer.Status.Idle, 'Newly added peer have idle status');

//   await Peer.clearAll();
//   t.end();
// });

// FIXME: Transaction verification failed because
// Transaction 0x133aa8f8877934bbd5d8d2f68bc41ebcc5d249f49c05383aebcff067b17d46d5
// Already saved
test('sync with longer peer chain', async (t) => {
  // Add block length 1 as default
  Chain.mainChain = await mock.chainWithBlocks(1, 1);

  const peer = new Peer(HOST_127_0_0_100, PORT_7000);

  t.equal(Chain.mainChain.getLength(), 1);
  t.equal(Chain.mainChain.isSynching(), false);

  // TODO: Make result be the new chain length
  const result = await peer.syncChain();
  t.equal(result, true);
  t.equal(Chain.mainChain.getLength(), 3);

  // TODO: Clear single peer
  await Peer.clearAll();
  await Chain.clearMain();
  t.end();
});

test('does not sync with shorter peer chain', async (t) => {
  // Add block length 1 as default
  Chain.mainChain = await mock.chainWithBlocks(1, 1);
  const peer = new Peer(HOST_127_0_0_99, PORT_7000);

  const data = {
    blockHeaders: headers.slice(0, 3),
  };

  Chain.mainChain = Chain.fromObject(data);

  t.equal(Chain.mainChain.getLength(), 3);
  // t.equal(Chain.mainChain.isSynching(), false);

  // // TODO: Make result be the new chain length
  const result = await peer.syncChain();
  t.equal(result, false);
  t.equal(Chain.mainChain.getLength(), 3);

  // TODO: Clear single peer
  await Peer.clearAll();
  await Chain.clearMain();
  t.end();
});

test('does not sync with unverified forward block', async (t) => {
  // Add block length 1 as default
  Chain.mainChain = await mock.chainWithBlocks(1, 1);
  const peer = new Peer(HOST_127_0_0_200, PORT_7000);

  t.equal(Chain.mainChain.getLength(), 1);
  t.equal(Chain.mainChain.isSynching(), false);

  // TODO: Make result be the new chain length
  const result = await peer.syncChain();
  t.equal(result, false);
  t.equal(Chain.mainChain.getLength(), 1);

  // FIXME: Check not blocks and transaction saved

  // TODO: Clear single peer
  await Peer.clearAll();
  await Chain.clearMain();
  t.end();
});

test('sync with peer chain skipped if currently synching with another peer', async (t) => {
  // Add block length 1 as default
  Chain.mainChain = await mock.chainWithBlocks(1, 1);
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);

  t.equal(Chain.mainChain.getLength(), 1);
  Chain.mainChain.setSynching(true);

  const result = await peer.syncChain();
  t.equal(result, true);
  t.equal(Chain.mainChain.getLength(), 1);

  // TODO: Clear single peer
  await Peer.clearAll();
  await Chain.clearMain();
  t.end();
});

test('fail to sync with peer that has invalid chain (invalid previous hash)', async (t) => {
  // Add block length 1 as default
  Chain.mainChain = await mock.chainWithBlocks(1, 1);
  const peer = new Peer(HOST_127_0_0_101, PORT_7000);

  t.equal(Chain.mainChain.getLength(), 1);
  t.equal(Chain.mainChain.isSynching(), false);

  const result = await peer.syncChain();
  t.equal(result, false);
  t.equal(Chain.mainChain.getLength(), 1);

  // TODO: Clear single peer
  await Peer.clearAll();
  await Chain.clearMain();
  t.end();
});

test('broadcast to all active peers', async (t) => {
  const activePeer = new Peer(HOST_127_0_0_100, PORT_7000);
  activePeer.setStatus(Peer.Status.Active);

  const idlePeer = new Peer(HOST_127_0_0_99, PORT_7000);
  idlePeer.setStatus(Peer.Status.Idle);

  const inactivePeer = new Peer(HOST_127_0_0_101, PORT_7000);
  inactivePeer.setStatus(Peer.Status.Inactive);

  await activePeer.save();
  await idlePeer.save();
  await inactivePeer.save();

  const savedPeers = await Peer.all();
  t.equal(savedPeers.length, 3);

  const result = await Peer.broadcastAction('nodeInfo');
  t.equal(result.length, 1, 'sent to one active peer');

  // TODO: Clear single peer
  await Peer.clearAll();
  t.end();
});

test('add seed peers', async (t) => {
  const initialPeers = await Peer.all();
  t.equal(initialPeers.length, 0);

  await Peer.addSeed();

  const seededPeers = await Peer.all();
  t.ok(Peer.SeedList.length > 0);
  t.equal(seededPeers.length, Peer.SeedList.length);

  // TODO: Clear single peer
  await Peer.clearAll();
  t.end();
});

// FIXME: Test reach out
test('reach out to active peer', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);
  t.equal((await Peer.all()).length, 0);

  const result = await peer.reachOut();
  t.equal(result, true);

  const peers = await Peer.all();

  // Total 4 peers, only 2 reachable
  console.log(peers);
  t.equal(peers.filter((p) => p.getStatus() === Peer.Status.Active).length, 2);
  t.equal(peers.length, 4);

  // TODO: Clear single peer
  await Peer.clearAll();
  t.end();
});

test('peer status is unreachable if unable to reach out', async (t) => {
  const peer = new Peer('127.0.0.222', PORT_7000);
  t.equal((await Peer.all()).length, 0);

  const result = await peer.reachOut();
  t.equal(result, false);

  const peers = await Peer.all();
  t.equal(peers.length, 1);
  t.equal(peers[0].getStatus(), Peer.Status.Unreachable);

  // TODO: Clear single peer
  await Peer.clearAll();
  t.end();
});

test('does not reach out to self as peer connecting to self', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);
  t.equal((await Peer.all()).length, 0);

  // Set matching nonce
  Peer.localNonce = 3000000;

  const result = await peer.reachOut();
  t.equal(result, false);
  t.equal((await Peer.all()).length, 0);

  // Deinit
  Peer.localNonce = 0;

  t.end();
});

test('delete peer after reach out if peer is self', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);
  await peer.save();

  const beforePeers = await Peer.all();
  t.equal(beforePeers.length, 1);

  // Match mock nodeInfo response nonce
  Peer.localNonce = 3000000;

  const result = await peer.reachOut();
  t.equal(result, false);

  // TODO: Clear single peer
  await Peer.clearAll();
  Peer.localNonce = 0;
  t.end();
});

test('does not add peer from different network', async (t) => {
  const peer = new Peer(HOST_127_0_0_200, PORT_7000);
  t.equal((await Peer.all()).length, 0);

  const result = await peer.reachOut();
  t.equal(result, false);
  t.equal((await Peer.all()).length, 0);

  t.end();
});

test('fetch peer chain success', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);

  const chain = await peer.fetchChain();
  t.ok(chain.getLength() > 0);

  // TODO: Clear single peer
  await Peer.clearAll();
  t.end();
});

test('delete peer after fail to connect four times', async (t) => {
  const peer = new Peer(HOST_127_0_0_200, PORT_7000);
  await peer.save();

  // Fail connection 3 times
  await Promise.all([
    peer.failConnect(),
    peer.failConnect(),
    peer.failConnect(),
  ]);

  t.equal((await Peer.all()).length, 1);

  await peer.failConnect();
  t.equal((await Peer.all()).length, 0);

  await Peer.clearAll();
  t.end();
});

test('set and parse peer request headers defaults', async (t) => {
  const request = {
    headers: Peer.requestHeaders(),
  };

  const {
    host, port, chainWork, chainLength, version,
  } = Peer.parseRequestHeaders(request);

  t.equal(host, '');
  t.equal(typeof (host), 'string');

  t.equal(port, 5438);
  t.equal(typeof (port), 'number');

  t.equal(chainWork, 1);
  t.equal(typeof (chainWork), 'number');

  t.equal(chainLength, 1);
  t.equal(typeof (chainLength), 'number');

  t.equal(version, '0.0.1');
  t.equal(typeof (version), 'string');

  t.end();
});

test('check if peer block work is significantly ahead', async (t) => {
  const numOfBlock = 3;
  Chain.mainChain = await mock.chainWithBlocks(numOfBlock, 5);

  const currentDifficulty = Chain.mainChain.getCurrentDifficulty();

  const aboveThreshold = Chain.mainChain.getTotalWork() + (currentDifficulty * 6);
  const belowThreshold = Chain.mainChain.getTotalWork() + (currentDifficulty * 2);

  const peer = new Peer(HOST_127_0_0_100, PORT_7000);
  peer.setTotalWork((numOfBlock * currentDifficulty) + aboveThreshold);
  t.equal(peer.isSignificantlyAhead(), true);

  peer.setTotalWork((numOfBlock * currentDifficulty) + belowThreshold);
  t.equal(peer.isSignificantlyAhead(), false);

  await Chain.clearMain();
  t.end();
});

test('reach out peer if inactive', async (t) => {
  const peer = new Peer(HOST_127_0_0_100, PORT_7000);

  peer.setStatus(Peer.Status.Active);
  t.equal(await peer.reachOutIfInactive(), false);

  peer.setStatus(Peer.Status.Incompatible);
  t.equal(await peer.reachOutIfInactive(), false);

  peer.setStatus(Peer.Status.Idle);
  t.equal(await peer.reachOutIfInactive(), true);

  await Peer.clearAll();

  peer.setStatus(Peer.Status.Inactive);
  t.equal(await peer.reachOutIfInactive(), true);

  await Peer.clearAll();
  t.end();
});

test('load existing peer', async (t) => {
  const peer = mock.nodePeer();
  await peer.save();

  const [resultPeer, created] = await Peer.loadOrDiscover(
    peer.getHost(),
    peer.getPort(),
  );

  t.ok(Peer.areSame(peer, resultPeer));
  t.equal(created, false);

  await Peer.clearAll();
  t.end();
});

test('discover non-existing peer', async (t) => {
  const peer = new Peer(HOST_127_0_0_200, PORT_7000);

  const [resultPeer, created] = await Peer.loadOrDiscover(
    HOST_127_0_0_200,
    PORT_7000,
  );

  t.ok(Peer.areSame(peer, resultPeer));
  t.equal(created, true);

  t.end();
});

test('request header keys have correct prefix', async (t) => {
  const values = Object.values(Peer.RequestHeader);

  for (let i = 0; i < values; i += 1) {
    t.ok(values[i].startsWith('chacha3-'));
  }

  t.end();
});

test('seed peer list if required or insufficient peers', async (t) => {
  const peer = mock.nodePeer();
  await peer.save();

  t.equal((await Peer.all()).length, 1);

  const list = await Peer.seedOrList();
  t.equal(list.length, 1 + Peer.SeedList.length);

  await Peer.clearAll();
  t.end();
});

test('init seed and reach out all peers', async (t) => {
  t.equal((await Peer.all()).length, 0);

  const results = await Peer.reachOutAll();
  t.ok(results.filter((success) => success).length > 0);
  t.ok((await Peer.all()).length > 0);

  await Peer.clearAll();
  t.end();
});

// test('set active peer status from compatibility', async (t) => {
//   // const compatiblePeer = new Peer(HOST_127_0_0_100, PORT_7000);
//   // compatiblePeer.setVersion('0.0.2');

//   // t.equal(compatiblePeer.isCompatible(), true);
//   // t.equal(compatiblePeer.getStatus(), Peer.Status.Idle);

//   // compatiblePeer.setCompatibilityStatus();

//   // const incompatiblePeer = new Peer(HOST_127_0_0_200, PORT_7000);
//   // incompatiblePeer.setVersion('0.0.0');

//   // t.equal(incompatiblePeer.isCompatible(), false);
//   // t.equal(compatiblePeer.getStatus(), Peer.Status.Idle);

//   // await Peer.clearAll();
//   t.end();
// });
