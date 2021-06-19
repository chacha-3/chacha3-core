const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const actions = require('../../actions');
// const app = require('../../app')();

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const { handler } = actions.listWallets;
  const { data, code } = await handler({ action: 'listWallet' });

  t.equal(data.length, 3);

  t.equal(typeof data[0].label, 'string');
  t.equal(typeof data[0].privateKey, 'string');
  t.equal(typeof data[0].publicKey, 'string');

  Wallet.clearAll();

  t.end();
});
