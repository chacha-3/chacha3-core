const { test } = require('tap');

const Peer = require('../../models/peer');
const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

const { runAction } = require('../../actions');

// const build = require('../../app');
const server = require('../../server');
const { all } = require('../../models/peer');

test('successfully reach out to peer', (t) => {
  // const app = build();
  t.plan(1);

  t.teardown(() => server.close());

  server.listen(2999, '127.0.0.1', async () => {
    const peer = new Peer('127.0.0.1', 2999);
    await peer.reachOut(true);

    t.equal(peer.getStatus(), Peer.Status.Active);
  });
});
