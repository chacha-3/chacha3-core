const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { SuccessCode, ErrorCode } = require('../../util/rpc');

const build = require('../../app');
const { randomNumberBetween } = require('../../util/math');
const Peer = require('../../models/peer');

test('should get node info', async (t) => {
  await mock.createWallets(3);

  const { data } = await runAction({
    action: 'nodeInfo',
  });

  t.ok(Object.prototype.hasOwnProperty.call(data, 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'time'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'chainWork'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'nonce'));

  await Wallet.clearAll();

  t.end();
});

test('should ping own node', async (t) => {
  const { code, message } = await runAction({
    action: 'ping',
  });

  t.equal(code, SuccessCode);
  t.equal(message, 'Pong');

  t.end();
});

test('should ping a node address', (t) => {
  const app = build();

  t.teardown(() => app.close());

  app.listen(0, async (err) => {
    t.error(err);

    const { code, message } = await runAction({
      action: 'pingNode',
      address: '127.0.0.1',
      port: app.server.address().port,
    });

    t.equal(code, SuccessCode);
    t.equal(message, 'Pong');

    await Peer.clearAll();

    t.end();
  });
});

test('ping an unavailable node', async (t) => {
  const { code } = await runAction({
    action: 'pingNode',
    address: '127.0.0.1',
    port: 48957,
  });

  t.equal(code, ErrorCode.Unavailable);

  await Peer.clearAll();
  t.end();
});
