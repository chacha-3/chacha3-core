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

  t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix, 'wallet has prefix');
  t.equal(encoded[Wallet.AddressPrefix.length], '1', 'wallet encoded address starts with 1');

  t.end();
});

// FIXME: Need password
test('should recover a wallet', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  const recoverWallet = Wallet.recover(oldWallet.getPrivateKey(), ''); // FIXME: Add pass

  t.equal(recoverWallet.getPrivateKeyHex(), oldWallet.getPrivateKeyHex(), 'recovered private key is set');
  t.equal(recoverWallet.getPublicKeyHex(), oldWallet.getPublicKeyHex(), 'public key is recovered');
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
    // console.log(e);
  }
  // TODO: Check error

  t.end();
});

test('get keys in hex format', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  t.equal(wallet.getPublicKeyHex(), wallet.getPublicKey().toString('hex'));
  t.equal(wallet.getPrivateKeyHex(), wallet.getPrivateKey().toString('hex'));

  t.end();
});

test('save and load wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.setLabel('myLabel');
  saveWallet.generate();
  await Wallet.save(saveWallet);

  const list = await Wallet.all();
  t.equal(list.length, 1);

  const loadWallet = await Wallet.load(saveWallet.getAddressEncoded());
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

// test('delete wallet', async (t) => {
//   const wallet = new Wallet();
//   wallet.setLabel('myLabel');
//   wallet.generate();
//   await Wallet.save(wallet);

//   const before = await Wallet.all();
//   t.equal(before.length, 1);

//   await Wallet.delete(wallet.getAddressEncoded());

//   const after = await Wallet.all();
//   t.equal(after.length, 0);

//   Wallet.clearAll();

//   t.end();
// });

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const all = await Wallet.all();
  t.equal(all.length, 3, 'Total 3 wallets in list');

  await Wallet.clearAll();
  t.end();
});

test('delete all wallet', async (t) => {
  const wallets = await mock.createWallets(3);

  await Wallet.setSelected(wallets[0].getAddressEncoded());
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

  await Wallet.setSelected(selectWallet.getAddressEncoded());
  selectedAddress = await Wallet.getSelected();

  t.equal(selectWallet.getAddressEncoded(), selectedAddress);

  // selectedAddress = await Wallet.getSelected();
  await Wallet.clearAll();

  t.end();
});

test('cannot select an unsaved wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const result = await Wallet.setSelected(wallet.getAddressEncoded());
  t.equal(result, false);

  await Wallet.clearAll();

  t.end();
});

test('unselect a selected wallet', async (t) => {
  const wallet = new Wallet();
  wallet.generate();
  await Wallet.save(wallet);

  await Wallet.setSelected(wallet.getAddressEncoded());

  let selectedAddress = await Wallet.getSelected();
  t.equal(wallet.getAddressEncoded(), selectedAddress, 'Have wallet before unselect');

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

  await Wallet.setSelected(wallet.getAddressEncoded());

  let selectedAddress = await Wallet.getSelected();
  t.equal(wallet.getAddressEncoded(), selectedAddress, 'Have wallet before delete');

  await Wallet.delete(wallet.getAddressEncoded());

  selectedAddress = await Wallet.getSelected();

  t.equal(selectedAddress, null, 'Have wallet unselected after delete');

  await Wallet.clearAll();

  t.end();
});


test('verify wallet address checksum', async (t) => {
  t.equal(Wallet.verifyAddress('114mRHezWdQx7MMTJ8QFokoqUraoB4ivKF'), true, 'Valid address');
  t.equal(Wallet.verifyAddress('114mRHezWdQx7MMTJ8QFokoqUraoB4ivK2'), false, 'Invalid checksum');

  t.end();
});

test('wallet string is address', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  t.equal(Wallet.verifyAddress(wallet.toString()), true, 'Valid address');
  t.end();
});
