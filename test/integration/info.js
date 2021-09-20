const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

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

// Require testing server
// test('should ping a node address', async (t) => {
//   const { code, message } = await runAction({
//     action: 'pingNode',
//   });

//   t.equal(code, SuccessCode);
//   t.equal(message, 'Pong');

//   t.end();
// });
