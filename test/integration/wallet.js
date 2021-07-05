const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const actions = require('../../actions');
// const app = require('../../app')();

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const { permission, handler } = actions.listWallets;
  const { data, code } = await handler();

  t.equal(permission, 'public'); // TODO: Change later
  t.equal(code, 'ok');

  t.equal(data.length, 3);

  t.equal(typeof data[0].label, 'string');
  t.equal(typeof data[0].privateKey, 'string');
  t.equal(typeof data[0].publicKey, 'string');

  await Wallet.clearAll();

  t.end();
});

test('create wallet', async (t) => {
  const { permission, handler } = actions.createWallet;
  const { data, code } = await handler({ label: 'myLabel' });

  t.equal(permission, 'public'); // TODO: Change later
  t.equal(code, 'ok');

  t.equal(typeof data.label, 'string');
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  const wallets = await Wallet.all();
  t.equal(wallets.length, 1);

  await Wallet.clearAll();

  t.end();
});
