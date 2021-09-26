const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

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
  const { code, data } = await runAction({
    action: 'createWallet',
    label: 'MyWalletLabel',
    password: 'xLrbjQ4uacvw',
  });

  t.equal(code, SuccessCode);
  t.equal(data.label, 'MyWalletLabel');

  t.equal(typeof data.label, 'string');
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  await Wallet.clearAll();

  t.end();
});

test('cannot create wallet without label', async (t) => {
  const { code } = await runAction({
    action: 'createWallet',
    password: 'pAeP8mmJDNpZ',
  });

  t.equal(code, ErrorCode.InvalidArgument);
  t.end();
});

test('unable to create wallet without password and prompts password', async (t) => {
  const { code, prompt } = await runAction({
    action: 'createWallet',
    label: 'No Password Supplied',
  });

  t.equal(code, ErrorCode.InvalidArgument);
  t.equal(prompt, 'password');

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

test('should select a default wallet', async (t) => {
  const wallets = await mock.createWallets(1);
  const address = wallets[0].getAddressEncoded();

  const { data } = await runAction({
    action: 'selectWallet',
    address,
  });

  t.equal(data.selected, address);

  await Wallet.clearAll();

  t.end();
});

test('should have the correct selected wallet', async (t) => {
  const [wallet] = await mock.createWallets(1);
  await Wallet.setSelected(wallet.getAddress());

  const { code, data } = await runAction({
    action: 'selectedWallet',
  });

  t.equal(code, SuccessCode);
  t.equal(data.label, wallet.getLabel());
  t.equal(data.address, wallet.getAddressEncoded());

  await Wallet.clearAll();

  t.end();
});

test('should have no selected wallet', async (t) => {
  const { code } = await runAction({
    action: 'selectedWallet',
  });

  t.equal(code, ErrorCode.NotFound);
  t.end();
});

test('should unselect a wallet', async (t) => {
  const [wallet] = await mock.createWallets(1);
  await Wallet.setSelected(wallet.getAddress());

  t.not(await Wallet.getSelected(), null);

  const { code } = await runAction({
    action: 'unselectWallet',
  });

  t.equal(code, SuccessCode);
  t.equal(await Wallet.getSelected(), null);

  await Wallet.clearAll();

  t.end();
});

test('should delete a saved wallet', async (t) => {
  const wallets = await mock.createWallets(1);

  const { code, data, message } = await runAction({
    action: 'deleteWallet',
    address: wallets[0].getAddressEncoded(),
  });

  t.equal(typeof data.address, 'string');

  // await Wallet.clearAll();
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

  t.equal(code, SuccessCode);

  const after = await Wallet.all();
  t.equal(after.length, 0);

  // await Wallet.clearAll();

  t.end();
});

test('should fail to remove unsaved wallet', async (t) => {
  // const wallets = await mock.createWallets(1);

  const { code } = await runAction({
    action: 'deleteWallet',
    address: 'random_address',
  });

  t.equal(code, ErrorCode.NotFound);
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

  t.equal(code, ErrorCode.InvalidArgument);
  t.end();
});
