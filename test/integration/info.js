const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');

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
