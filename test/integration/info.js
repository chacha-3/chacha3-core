const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const app = require('../../app')();

test('should get node info', async (t) => {
  await mock.createWallets(3);

  const { data } = await runAction({
    action: 'nodeInfo',
  });

  t.ok(Object.prototype.hasOwnProperty.call(data, 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'time'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'listening'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'length'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'nonce'));

  await Wallet.clearAll();

  t.end();
});
