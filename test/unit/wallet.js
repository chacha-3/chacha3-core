const { test } = require('tap');
// const chai = require('chai');

const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');

// const { expect } = chai;

test('should create a wallet key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  // t.equal(wallet.getPrivateKey().length, 185, 'private key has length 185');
  // t.equal(wallet.getPublicKey().length, 120, 'public key has length 120');

  t.end();
});

test('walley key objects', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  // const { privateKey, publicKey } = wallet.getKeyObjects();

  t.type(typeof (wallet.getPrivateKeyObject()), 'object', 'private key is an object');
  t.type(typeof (wallet.getPublicKeyObject()), 'object', 'public key is an object');

  t.end();
});

// test('wallet key in pem format', (t) => {
//   const wallet = new Wallet();
//   wallet.generate();

//   const { privateKey, publicKey } = wallet.getKeysPem();

//   t.equal(privateKey.startsWith('-----BEGIN PRIVATE KEY-----'), true, 'private key in pem format');
//   t.equal(publicKey.startsWith('-----BEGIN PUBLIC KEY-----'), true, 'public key in pem format');

//   t.end();
// });

// test('should get wallet address', (t) => {
//   const wallet = new Wallet();
//   wallet.generate();

//   const address = wallet.getAddress();
//   t.equal(address.length, 25, 'address length is 25', 'address has length 25');
//   t.equal(address[0], 0, 'address starts with 0');
//   t.end();
// });

test('set and get wallet label', (t) => {
  const wallet = new Wallet();
  wallet.setLabel('testLabel');

  t.equal(wallet.getLabel(), 'testLabel', 'wallet label is correct');
  t.end();
});

test('should get encoded wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const encoded = wallet.getAddressEncoded();

  t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix, 'wallet has prefix');
  t.equal(encoded[Wallet.AddressPrefix.length], '1', 'wallet encoded address starts with 1');

  t.end();
});

// FIXME: Need password
test('should recover a wallet', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  const recoverWallet = new Wallet();
  recoverWallet.recover(oldWallet.getPrivateKey(), ''); // FIXME: Add pass

  t.equal(recoverWallet.getKeysHex().privateKey, oldWallet.getKeysHex().privateKey, 'recovered private key is set');
  t.equal(recoverWallet.getKeysHex().publicKey, oldWallet.getKeysHex().publicKey, 'public key is recovered');
  t.end();
});

test('save and load wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.setLabel('myLabel');
  saveWallet.generate();
  await saveWallet.save();

  const list = await Wallet.all();
  t.equal(list.length, 1);

  const loadWallet = new Wallet();
  await loadWallet.load(saveWallet.getAddressEncoded());

  t.equal(loadWallet.getLabel(), 'myLabel');

  t.equal(saveWallet.getKeysHex().privateKey, loadWallet.getKeysHex().privateKey);
  t.equal(saveWallet.getKeysHex().publicKey, loadWallet.getKeysHex().publicKey);

  await loadWallet.delete();
  t.end();
});

test('does not load unsaved wallet', async (t) => {
  const loadWallet = new Wallet();
  const result = await loadWallet.load('random_address');

  t.equal(result, false);
  t.end();
});

test('delete wallet', async (t) => {
  const wallet = new Wallet();
  wallet.setLabel('myLabel');
  wallet.generate();
  await wallet.save();

  const before = await Wallet.all();
  t.equal(before.length, 1);

  await wallet.delete();

  const after = await Wallet.all();
  t.equal(after.length, 0);

  t.end();
});

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const all = await Wallet.all();
  t.equal(all.length, 3, 'Total 3 wallets in list');

  Wallet.clearAll();
  t.end();
});

test('delete all wallet', async (t) => {
  await mock.createWallets(3);
  await Wallet.clearAll();

  const all = await Wallet.all();
  t.equal(all.length, 0, 'No wallet in list');
  t.end();
});

test('set a selected wallet', async (t) => {
  const numOfWallets = 3;
  await mock.createWallets(numOfWallets);

  const list = await Wallet.all();
  const selectWallet = list[Math.floor(Math.random() * numOfWallets)];

  let selected = await Wallet.getSelected();
  t.equal(selected, null, 'Have not selected wallet');

  await Wallet.setSelected(selectWallet);
  selected = await Wallet.getSelected();
  t.equal(selectWallet.getAddressEncoded(), selected.getAddressEncoded());

  await Wallet.clearAll();

  t.end();
});

test('unselect a selected wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();
  await wallet.save();

  await Wallet.setSelected(wallet);

  let selected = await Wallet.getSelected();
  t.equal(wallet.getAddressEncoded(), selected.getAddressEncoded(), 'Have wallet before unselect');

  await Wallet.setSelected(null);
  selected = await Wallet.getSelected();

  t.equal(selected, null, 'Have no wallet after unselect');

  await Wallet.clearAll();

  t.end();
});

test('verify wallet address checksum', async (t) => {
  t.equal(Wallet.verifyAddress('114mRHezWdQx7MMTJ8QFokoqUraoB4ivKF'), true, 'Valid address');
  t.equal(Wallet.verifyAddress('114mRHezWdQx7MMTJ8QFokoqUraoB4ivK2'), false, 'Invalid checksum');

  t.end();
});
