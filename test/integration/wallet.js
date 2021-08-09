const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const app = require('../../app')();

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const { data } = await runAction({
    action: 'listWallets',
    label: 'MyWalletLabel',
  });

  t.equal(data.length, 3);

  t.equal(typeof data[0].label, 'string');
  t.equal(typeof data[0].privateKey, 'string');
  t.equal(typeof data[0].publicKey, 'string');

  await Wallet.clearAll();

  t.end();
});

test('create wallet', async (t) => {
  const { data } = await runAction({
    action: 'createWallet',
    label: 'MyWalletLabel',
  });

  t.equal(data.label, 'MyWalletLabel');

  t.equal(typeof data.label, 'string');
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  await Wallet.clearAll();

  t.end();
});

test('generate wallet', async (t) => {
  const { data } = await runAction({
    action: 'generateWallet',
  });

  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.end();
});

test('should delete a saved wallet', async (t) => {
  const wallets = await mock.createWallets(1);

  const { data } = await runAction({
    action: 'deleteWallet',
    address: wallets[0].getAddressEncoded(),
  });

  t.equal(typeof data.address, 'string');
  t.end();
});

test('should delete all saved wallet', async (t) => {
  const numOfWallets = 3;

  await mock.createWallets(3);

  const before = await Wallet.all();
  t.equal(before.length, numOfWallets);

  const { code } = await runAction({
    action: 'deleteAllWallets',
  });

  t.equal(code, 'ok');

  const after = await Wallet.all();
  t.equal(after.length, 0);

  t.end();
});

test('should fail to remove unsaved wallet', async (t) => {
  // const wallets = await mock.createWallets(1);

  const { code } = await runAction({
    action: 'deleteWallet',
    address: 'random_address',
  });

  t.equal(code, 'not_found');
  t.end();
});

test('should recover a wallet', async (t) => {
  // const wallets = await mock.createWallets(1);
  const wallet = new Wallet();
  wallet.generate();

  const { data } = await runAction({
    action: 'recoverWallet',
    privateKey: wallet.getPrivateKeyHex(),
    label: 'Recovered wallet',
  });

  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.end();

  await Wallet.clearAll();
});

test('should not recover a wallet without correct private key', async (t) => {
  const { code } = await runAction({
    action: 'recoverWallet',
    privateKey: 'notAPrivateKey',
    label: 'Not key',
  });

  t.equal(code, 'fail');
  t.end();
});
