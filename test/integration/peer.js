const { test } = require('tap');

const Peer = require('../../models/peer');
const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

const { runAction } = require('../../actions');

// const build = require('../../app');
const server = require('../../server');

// test('successfully reach out to peer', (t) => {
//   // const app = build();
//   // t.plan(1);

//   // t.teardown(() => server.close(() => {
//   //   console.log('closed');
//   // }));

//   server.listen(2999, '127.0.0.1', async () => {
//     const peer = new Peer('127.0.0.1', 2999);
//     await peer.reachOut(true);

//     t.equal(peer.getStatus(), Peer.Status.Active);

//     t.end();
//     // server.close(() => {
//     //   console.log('end');
//     //   t.end();
//     // });
//   });
// });

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
