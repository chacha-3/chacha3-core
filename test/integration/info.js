const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const app = require('../../app')();

process.on('unhandledRejection', (err) => {
  console.log('handler');
});

test('should get node info', async (t) => {
  await mock.createWallets(3);

  const { data } = await runAction({
    action: 'nodeInfo',
  });

  t.ok(Object.prototype.hasOwnProperty.call(data, 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'time'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'listenPort'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'nonce'));

  await Wallet.clearAll();

  t.end();
});
