const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');
const Chain = require('../../models/chain');

const { runAction } = require('../../actions');

const { SuccessCode, ErrorCode } = require('../../util/rpc');
const Block = require('../../models/block');
const { deserializeBigInt } = require('../../util/serialize');

test('list all wallet', async (t) => {
  await mock.createWallets(3);
  const { code, data } = await runAction({
    action: 'listWallets',
  });

  t.equal(code, SuccessCode);
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
    password: mock.randomPassword(),
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

test('verify wallet password access with correct password', async (t) => {
  const password = mock.randomPassword();
  const [wallet] = await mock.createWallets(1, password);

  const { code, data } = await runAction({
    action: 'verifyWallet',
    address: wallet.getAddressEncoded(),
    password,
  });

  t.equal(code, SuccessCode);
  t.equal(data.password, true);

  await Wallet.clearAll();

  t.end();
});

test('verify wallet password access with correct password', async (t) => {
  const password = mock.randomPassword();
  const [wallet] = await mock.createWallets(1, password);

  const { code, data } = await runAction({
    action: 'verifyWallet',
    address: wallet.getAddressEncoded(),
    password: 'C6sBg9p9R8vN',
  });

  t.equal(code, SuccessCode);
  t.equal(data.password, false);

  await Wallet.clearAll();

  t.end();
});

test('unable to verify unsaved wallet', async (t) => {
  const password = mock.randomPassword();

  const unsavedWallet = new Wallet();
  await unsavedWallet.generate(password);

  const { code } = await runAction({
    action: 'verifyWallet',
    address: unsavedWallet.getAddressEncoded(),
    password,
  });

  t.equal(code, ErrorCode.NotFound);
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

test('cannot create wallet with weak password', async (t) => {
  const { code, errors } = await runAction({
    action: 'createWallet',
    password: 'abc123',
    label: 'Weak password',
  });

  t.equal(code, ErrorCode.InvalidArgument);
  t.ok(errors.length > 0);

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
  const password = mock.randomPassword();

  const { code, data } = await runAction({
    action: 'generateWallet',
    password,
  });

  t.equal(code, SuccessCode);
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.end();
});

test('should select a default wallet', async (t) => {
  const wallets = await mock.createWallets(1);
  const address = wallets[0].getAddressEncoded();

  const { code, data } = await runAction({
    action: 'selectWallet',
    address,
  });

  t.equal(code, SuccessCode);
  t.equal(data.selected, address);

  await Wallet.clearAll();

  t.end();
});

test('should not be able to select an unsaved wallet', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const { code } = await runAction({
    action: 'selectWallet',
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, ErrorCode.NotFound);
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

  const { code, data } = await runAction({
    action: 'deleteWallet',
    address: wallets[0].getAddressEncoded(),
  });

  t.equal(code, SuccessCode);
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
  const password = mock.randomPassword();

  const wallet = new Wallet();
  await wallet.generate(password);

  const { code, data } = await runAction({
    action: 'recoverWallet',
    privateKey: wallet.getPrivateKeyHex(),
    label: 'Recovered wallet',
    password,
  });

  t.equal(code, SuccessCode);
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  await Wallet.clearAll();
  t.end();
});

test('should change a wallet password', async (t) => {
  const currentPassword = mock.randomPassword();
  const newPassword = mock.randomPassword();

  const [wallet] = await mock.createWallets(1, currentPassword);

  const { code, data } = await runAction({
    action: 'changeWalletPassword',
    currentPassword,
    newPassword,
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, SuccessCode);
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.not(data.privateKey, wallet.getPrivateKeyHex());

  await Wallet.clearAll();
  t.end();
});

test('should not change a wallet password with incorrect password', async (t) => {
  const currentPassword = mock.randomPassword();
  const newPassword = mock.randomPassword();
  const incorrectPassword = mock.randomPassword();

  const [wallet] = await mock.createWallets(1, currentPassword);

  const { code } = await runAction({
    action: 'changeWalletPassword',
    currentPassword: incorrectPassword,
    newPassword,
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, ErrorCode.InvalidArgument);

  await Wallet.clearAll();
  t.end();
});

test('should prompt current and new password to change password if not provided', async (t) => {
  const currentPassword = mock.randomPassword();

  const [wallet] = await mock.createWallets(1, currentPassword);

  const { code, prompt } = await runAction({
    action: 'changeWalletPassword',
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, ErrorCode.InvalidArgument);

  const prompts = prompt.split('|');
  t.ok(prompts.includes('currentPassword') && prompts.includes('newPassword'));

  await Wallet.clearAll();
  t.end();
});

test('should be unable to recover wallet with incorrect password', async (t) => {
  const password = mock.randomPassword();

  const wallet = new Wallet();
  await wallet.generate(password);

  const { code } = await runAction({
    action: 'recoverWallet',
    privateKey: wallet.getPrivateKeyHex(),
    label: 'Recovered wallet',
    password: 'HSaLJniX7FfZ',
  });

  t.equal(code, ErrorCode.InvalidArgument);
  await Wallet.clearAll();

  t.end();
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

// TODO: Move to account model?
test('should have correct wallet account balance', async (t) => {
  const blockCount = 4;
  const minusGenesis = blockCount - 1;

  const wallet = new Wallet();
  await wallet.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, wallet);

  const { code, data } = await runAction({
    action: 'accountBalance',
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, SuccessCode);

  const expectedBalance = Block.InitialReward * BigInt(minusGenesis);

  const { balance } = data;
  t.equal(deserializeBigInt(balance), expectedBalance);

  await Chain.clearMain();

  t.end();
});

test('should return account balance of selected wallet if address not provided', async (t) => {
  const blockCount = 3;
  const minusGenesis = blockCount - 1;

  const [wallet] = await mock.createWallets(1);
  await Wallet.setSelected(wallet.getAddress());

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, wallet);

  const { code, data } = await runAction({
    action: 'accountBalance',
  });

  t.equal(code, SuccessCode);

  const expectedBalance = Block.InitialReward * BigInt(minusGenesis);

  const { balance } = data;
  t.equal(deserializeBigInt(balance), expectedBalance);

  await Wallet.clearAll();
  await Chain.clearMain();

  t.end();
});

test('should list account transactions', async (t) => {
  const blockCount = 4;
  const minusGenesis = blockCount - 1;

  const wallet = new Wallet();
  await wallet.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, wallet);

  const { code, data } = await runAction({
    action: 'accountTransactions',
    address: wallet.getAddressEncoded(),
  });

  t.equal(code, SuccessCode);
  t.equal(data.length, minusGenesis);

  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'id'));

  await Chain.clearMain();

  t.end();
});

test('should list account transactions of selected wallet', async (t) => {
  const blockCount = 4;
  const minusGenesis = blockCount - 1;

  const [wallet] = await mock.createWallets(1);
  await Wallet.setSelected(wallet.getAddress());

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, wallet);

  const { code, data } = await runAction({
    action: 'accountTransactions',
  });

  t.equal(code, SuccessCode);
  t.equal(data.length, minusGenesis);

  t.ok(Object.prototype.hasOwnProperty.call(data[0], 'id'));

  await Wallet.clearAll();
  await Chain.clearMain();

  t.end();
});
