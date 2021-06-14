const { test } = require('tap');
// const chai = require('chai');

const Wallet = require('../../models/wallet');

// const { expect } = chai;

test('should have no wallet index', (t) => {
  t.equal(Wallet.list.getSize(), 0);
  t.end();
});

// test('save and load wallet index', async (t) => {
//   Wallet.addIndex('keyName');
//   await Wallet.saveIndex();

//   await Wallet.loadIndex();
//   t.equal(Wallet.index.length, 1);

//   await Wallet.clearIndex();

//   t.equal(Wallet.index.length, 0);
//   t.end();
// });

test('should create a wallet key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysBuffer();

  t.equal(privateKey.length, 185, 'private key has length 185');
  t.equal(publicKey.length, 120, 'public key has length 120');

  t.end();
});

test('walley key objects', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeys();

  t.type(typeof (privateKey), 'object', 'private key is an object');
  t.type(typeof (publicKey), 'object', 'public key is an object');

  t.end();
});

test('wallet key in pem format', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysPem();

  t.equal(privateKey.startsWith('-----BEGIN PRIVATE KEY-----'), true, 'private key in pem format');
  t.equal(publicKey.startsWith('-----BEGIN PUBLIC KEY-----'), true, 'public key in pem format');

  t.end();
});

test('should get wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const address = wallet.getAddress();
  t.equal(address.length, 25, 'address length is 25', 'address has length 25');
  t.equal(address[0], 0, 'address starts with 0');
  t.end();
});

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

test('should recover a wallet', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  const { privateKey } = oldWallet.getKeys();

  const recoverWallet = new Wallet();
  recoverWallet.recover(privateKey);

  t.equal(recoverWallet.getKeysHex().privateKey, oldWallet.getKeysHex().privateKey, 'recovered private key is set');
  t.equal(recoverWallet.getKeysHex().publicKey, oldWallet.getKeysHex().publicKey, 'public key is recovered');
  t.end();
});

test('save and load wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.setLabel('myLabel');
  saveWallet.generate();
  await saveWallet.save();

  const loadWallet = new Wallet();
  await loadWallet.load(saveWallet.getAddressEncoded());

  t.equal(loadWallet.getLabel(), 'myLabel');

  t.equal(saveWallet.getKeysHex().privateKey, loadWallet.getKeysHex().privateKey);
  t.equal(saveWallet.getKeysHex().publicKey, loadWallet.getKeysHex().publicKey);

  await loadWallet.delete();

  t.end();
});

test('delete wallet', async (t) => {
  // const deleteWallet = new Wallet();
  // deleteWallet.setLabel('deleteThis');
  // deleteWallet.generate();

  // await deleteWallet.save();
  // await deleteWallet.delete();

  // const loadWallet = new Wallet();
  // const result = await loadWallet.load(deleteWallet.getAddressEncoded());

  // t.equal(result, false, 'Cannot load deleted wallet');
  // t.end();
});

test('list all wallet', async (t) => {
  // const createWallet = async (i) => {
  //   const wallet = new Wallet();
  //   wallet.setLabel(`addWallet${i}`);
  //   wallet.generate();

  //   await wallet.save();
  // };

  // for (let i = 0; i < 3; i += 1) {
  //   // eslint-disable-next-line no-await-in-loop
  //   await createWallet(i);
  // }

  // const list = await Wallet.listAll();
  // console.log(list);
  // t.equal(list.length, 3);

  // console.log(list);

  // deleteWallet.setLabel('deleteThis');
  // deleteWallet.generate();

  // await deleteWallet.save();
  // await deleteWallet.delete();

  // const loadWallet = new Wallet();
  // const result = await loadWallet.load(deleteWallet.getAddressEncoded());

  // t.equal(result, false, 'Cannot load deleted wallet');
  Wallet.deleteAll();
  t.end();
});

test('delete all wallet', async (t) => {
  // Wallet.deleteAll();
  // const createWallet = async (i) => {
  //   const saveWallet = new Wallet();
  //   saveWallet.setLabel(`addWallet${i}`);
  //   saveWallet.generate();
  // };

  // await Promise.all([createWallet(1), createWallet(2), createWallet(3)]);

  // const list = Wallet.listAll();

  // deleteWallet.setLabel('deleteThis');
  // deleteWallet.generate();

  // await deleteWallet.save();
  // await deleteWallet.delete();

  // const loadWallet = new Wallet();
  // const result = await loadWallet.load(deleteWallet.getAddressEncoded());

  // t.equal(result, false, 'Cannot load deleted wallet');
  t.end();
});
