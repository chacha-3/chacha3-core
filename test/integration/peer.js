const { test } = require('tap');

const Peer = require('../../models/peer');
const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

const { runAction } = require('../../actions');

const build = require('../../app');
const { all } = require('../../models/peer');

test('reach out to peer', async (t) => {
  // const app = build();
  // t.plan(5);

  // t.teardown(() => app.close());

  // app.listen(0, (err) => {
  //   t.error(err);

  //   const peer = new Peer('127.0.0.1', 0);
  //   peer.reachOut();
  // });
  // const peer = new Peer('127.0.0.1', process.env.PORT);
  // console.log(peer);
  // const response = await app.inject({
  //   method: 'POST',
  //   url: '/',
  //   payload: {
  //     action: 'createTransaction',
  //   },
  // });

  // t.end();
});
