const { test } = require('tap');
// const chai = require('chai');

const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');
const { serializeBuffer, deserializeBuffer } = require('../../util/serialize');

// const { expect } = chai;

test('should create a wallet key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  // TODO:

  // t.equal(wallet.getPrivateKey().length, 185, 'private key has length 185');
  // t.equal(wallet.getPublicKey().length, 120, 'public key has length 120');

  t.end();
});

// test('walley key objects', (t) => {
//   const wallet = new Wallet();
//   wallet.generate();

//   // const { privateKey, publicKey } = wallet.getKeyObjects();

//   t.type(typeof (wallet.getPrivateKeyObject()), 'object', 'private key is an object');
//   t.type(typeof (wallet.getPublicKeyObject()), 'object', 'public key is an object');

//   t.end();
// });

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

test('correct wallet prefix', (t) => {
  // TODO: Set
  t.equal(Wallet.AddressPrefix, '');
  t.end();
});

test('set and get wallet label', (t) => {
  const wallet = new Wallet();
  t.equal(wallet.getLabel(), '', 'wallet label is blank');

  wallet.setLabel(null);
  t.equal(wallet.getLabel(), '', 'wallet label is empty');

  wallet.setLabel('testLabel');
  t.equal(wallet.getLabel(), 'testLabel', 'wallet label is correct');
  t.end();
});

test('should get encoded wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const encoded = wallet.getAddressEncoded();
  t.equal(encoded.slice(0, 4), '0x00');

  // FIXME:
  // t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix, 'wallet has prefix');
  // t.equal(encoded[Wallet.AddressPrefix.length], '1', 'wallet encoded address starts with 1');

  t.end();
});

test('should recover a wallet with correct password', (t) => {
  const password = 'fXYpgaV5rFp6';

  const oldWallet = new Wallet();
  oldWallet.generate(password);

  const recoverWallet = Wallet.recover(oldWallet.getPrivateKey(), password);

  t.equal(recoverWallet.getPrivateKeyHex(), oldWallet.getPrivateKeyHex(), 'recovered private key is set');
  t.equal(recoverWallet.getPublicKeyHex(), oldWallet.getPublicKeyHex(), 'public key is recovered');
  t.end();
});

test('should not recover a wallet with incorrect password', (t) => {
  const password = '2AUJZjwDPe88';

  const oldWallet = new Wallet();
  oldWallet.generate(password);

  const result = Wallet.recover(oldWallet.getPrivateKey(), 'spP9PjjwwL8X');
  t.equal(result, null);

  t.end();
});

test('should not recover a wallet with invalid key', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  try {
    const recoverWallet = Wallet.recover('not_a_key', '');
    t.equal(recoverWallet.getPrivateKeyHex(), oldWallet.getPrivateKeyHex(), 'recovered private key is set');
    t.equal(recoverWallet.getPublicKeyHex(), oldWallet.getPublicKeyHex(), 'public key is recovered');
  } catch (e) {

  }
  // TODO: Check error

  t.end();
});

test('get keys in hex format', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  t.equal(wallet.getPublicKeyHex(), serializeBuffer(wallet.getPublicKey()));
  t.equal(wallet.getPrivateKeyHex(), serializeBuffer(wallet.getPrivateKey()));

  t.end();
});

test('save and load wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.setLabel('myLabel');
  saveWallet.generate();
  await Wallet.save(saveWallet);

  const list = await Wallet.all();
  t.equal(list.length, 1);

  const loadWallet = await Wallet.load(saveWallet.getAddress());
  t.equal(loadWallet.getLabel(), 'myLabel');

  t.equal(saveWallet.getPrivateKeyHex(), loadWallet.getPrivateKeyHex());
  t.equal(saveWallet.getPublicKeyHex(), loadWallet.getPublicKeyHex());

  await Wallet.clearAll();
  t.end();
});

test('does not load unsaved wallet', async (t) => {
  const result = await Wallet.load('random_address');

  t.equal(result, null);
  t.end();
});

test('delete wallet', async (t) => {
  const wallet = new Wallet();
  wallet.setLabel('myLabel');
  wallet.generate();
  await Wallet.save(wallet);

  const before = await Wallet.all();
  t.equal(before.length, 1);

  await Wallet.delete(wallet.getAddress());

  const after = await Wallet.all();
  t.equal(after.length, 0);

  await Wallet.clearAll();

  t.end();
});

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const all = await Wallet.all();
  t.equal(all.length, 3, 'Total 3 wallets in list');

  await Wallet.clearAll();
  t.end();
});

test('delete all wallet', async (t) => {
  const wallets = await mock.createWallets(3);

  await Wallet.setSelected(wallets[0].getAddress());
  await Wallet.clearAll();

  const all = await Wallet.all();
  t.equal(all.length, 0, 'No wallet in list');

  const selectedWallet = await Wallet.getSelected();
  t.equal(selectedWallet, null, 'Unselected wallet after deleting all');

  t.end();
});

test('set a selected wallet', async (t) => {
  const numOfWallets = 3;
  await mock.createWallets(numOfWallets);

  const list = await Wallet.all();
  const selectWallet = list[Math.floor(Math.random() * numOfWallets)];

  let selectedAddress = await Wallet.getSelected();
  t.equal(selectedAddress, null, 'Have not selected wallet');

  await Wallet.setSelected(selectWallet.getAddress());
  selectedAddress = await Wallet.getSelected();

  t.ok(selectWallet.getAddress().equals(selectedAddress));

  // selectedAddress = await Wallet.getSelected();
  await Wallet.clearAll();

  t.end();
});

test('cannot select an unsaved wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const result = await Wallet.setSelected(wallet.getAddress());
  t.equal(result, false);

  await Wallet.clearAll();

  t.end();
});

test('unselect a selected wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();
  await Wallet.save(wallet);

  await Wallet.setSelected(wallet.getAddress());

  let selectedAddress = await Wallet.getSelected();
  t.ok(wallet.getAddress().equals(selectedAddress), 'Have wallet before unselect');

  const result = await Wallet.setSelected(null);
  t.equal(result, true);

  selectedAddress = await Wallet.getSelected();

  t.equal(selectedAddress, null, 'Have no wallet after unselect');

  await Wallet.clearAll();

  t.end();
});

test('unselect a deleted wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();
  await Wallet.save(wallet);

  await Wallet.setSelected(wallet.getAddress());

  let selectedAddress = await Wallet.getSelected();
  t.ok(wallet.getAddress().equals(selectedAddress), 'Have wallet before delete');

  await Wallet.delete(wallet.getAddress());

  selectedAddress = await Wallet.getSelected();

  t.equal(selectedAddress, null, 'Have wallet unselected after delete');

  await Wallet.clearAll();

  t.end();
});

test('verify wallet address checksum', async (t) => {
  t.equal(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcF')), true, 'Valid address');
  t.equal(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7baf22')), false, 'Invalid checksum');

  t.end();
});

test('verify address by length', async (t) => {
  t.equal(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7baf')), false, 'Address too short');
  t.equal(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcFee')), false, 'Address too long');

  t.end();
});
