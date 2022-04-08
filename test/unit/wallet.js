const crypto = require('crypto');
const { test } = require('tap');

const Wallet = require('../../models/wallet');

const mock = require('../../util/mock');
const { serializeBuffer, deserializeBuffer } = require('../../util/serialize');

test('should create a wallet key', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  t.equal(wallet.getPrivateKey().length, 230, 'private key has length 230');
  t.equal(wallet.getPublicKey().length, 120, 'public key has length 120');

  t.end();
});

test('should get wallet address', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  t.equal(wallet.getAddress().length, 25, 'address length of 25');
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

test('should get encoded wallet address', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const encoded = wallet.getAddressEncoded();
  t.equal(encoded.slice(0, 4), '0x00');
  t.equal(encoded.length, 52);

  t.end();
});

test('should recover a wallet with correct password', async (t) => {
  const password = mock.randomPassword();

  const oldWallet = new Wallet();
  await oldWallet.generate(password);

  const recoverWallet = await Wallet.recover(oldWallet.getPrivateKey(), password);

  t.equal(
    recoverWallet.getPrivateKeyHex(),
    oldWallet.getPrivateKeyHex(),
    'recovered private key is set',
  );

  t.equal(
    recoverWallet.getPublicKeyHex(),
    oldWallet.getPublicKeyHex(),
    'public key is recovered',
  );

  t.end();
});

test('should not recover a wallet with incorrect password', async (t) => {
  const correctPassword = mock.randomPassword();
  const incorrectPassword = mock.randomPassword();

  const oldWallet = new Wallet();
  await oldWallet.generate(correctPassword);

  const result = await Wallet.recover(oldWallet.getPrivateKey(), incorrectPassword);
  t.equal(result, null);

  t.end();
});

test('should change the wallet password', async (t) => {
  const oldPassword = mock.randomPassword();
  const newPassword = mock.randomPassword();

  const wallet = new Wallet();
  await wallet.generate(oldPassword);

  const privateKeyBefore = wallet.getPrivateKey();
  const publicKeyBefore = wallet.getPublicKey();

  const changed = await wallet.changePassword(oldPassword, newPassword);
  t.equal(changed, true);

  const privateKeyAfter = wallet.getPrivateKey();
  const publicKeyAfter = wallet.getPublicKey();

  t.notOk(privateKeyBefore.equals(privateKeyAfter), 'encrypted private key is different');
  t.ok(publicKeyBefore.equals(publicKeyAfter), 'public key remains same');

  t.equal(await Wallet.recover(wallet.getPrivateKey(), oldPassword), null);
  t.not(await Wallet.recover(wallet.getPrivateKey(), newPassword), null);

  t.end();
});

test('should not recover a wallet with invalid key', async (t) => {
  const oldWallet = new Wallet();
  await oldWallet.generate();

  const recovered = await Wallet.recover('not_a_key', '');
  t.equal(recovered, null);

  t.end();
});

test('get keys in hex format', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  t.equal(wallet.getPublicKeyHex(), serializeBuffer(wallet.getPublicKey()));
  t.equal(wallet.getPrivateKeyHex(), serializeBuffer(wallet.getPrivateKey()));

  t.end();
});

test('save and load wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.setLabel('myLabel');
  await saveWallet.generate();
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
  await wallet.generate();
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
  await wallet.generate();

  const result = await Wallet.setSelected(wallet.getAddress());
  t.equal(result, false);

  await Wallet.clearAll();

  t.end();
});

test('unselect a selected wallet', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();
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
  await wallet.generate();
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

test('verify generated  wallet address checksum', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  t.equal(Wallet.verifyAddress(wallet.getAddress()), true, 'Valid address');

  t.end();
});

test('verify wallet address checksum', async (t) => {
  t.ok(Wallet.verifyAddress(deserializeBuffer('0x00d5e1f206ff157b3684869106e6dea18dc02031be5196b069')), 'Valid address');
  t.notOk(Wallet.verifyAddress(deserializeBuffer('0x00d5e1f206ff157b3684869106e6dea18dc02031be5196b079')), 'Invalid checksum');

  t.end();
});

test('verify address by length', async (t) => {
  t.notOk(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7baf')), 'Address too short');
  t.notOk(Wallet.verifyAddress(deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafcFee')), 'Address too long');

  t.end();
});

test('derived encryption key is always equal with same salt', async (t) => {
  const password = mock.randomPassword();
  const salt = crypto.randomBytes(12);

  const key1 = await Wallet.deriveEncryptionKey(password, salt);
  const key2 = await Wallet.deriveEncryptionKey(password, salt);

  t.ok(key1.equals(key2));
  t.end();
});

test('encrypt and decrypt private key', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const password = mock.randomPassword();

  const encrypted = await Wallet.encryptPrivateKey(wallet.getPrivateKey(), password);
  t.equal(encrypted[0], 0x00);

  const decrypted = await Wallet.decryptPrivateKey(encrypted, password);
  t.ok(wallet.getPrivateKey().equals(decrypted));

  t.end();
});

test('unable to decrypt private key with incorrect password', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const correctPassword = mock.randomPassword();
  const incorrectPassword = mock.randomPassword();

  const encrypted = await Wallet.encryptPrivateKey(wallet.getPrivateKey(), correctPassword);
  t.equal(encrypted[0], 0x00);

  const decrypted = await Wallet.decryptPrivateKey(encrypted, incorrectPassword);
  t.equal(decrypted, null);

  t.end();
});
