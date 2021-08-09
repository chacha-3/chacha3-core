const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { routeAction } = require('../../actions');
const app = require('../../app')();

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'listWallets',
      label: 'MyWalletLabel',
    },
  });

  t.equal(response.statusCode, 200);

  const { data } = response.json();
  t.equal(data.length, 3);

  t.equal(typeof data[0].label, 'string');
  t.equal(typeof data[0].privateKey, 'string');
  t.equal(typeof data[0].publicKey, 'string');

  await Wallet.clearAll();

  t.end();
});

test('create wallet', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'createWallet',
      label: 'MyWalletLabel',
    },
  });

  t.equal(response.statusCode, 200);

  const { data } = response.json();
  t.equal(data.label, 'MyWalletLabel');

  t.equal(typeof data.label, 'string');
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  await Wallet.clearAll();

  t.end();
});

test('generate wallet', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'generateWallet',
    },
  });

  t.equal(response.statusCode, 200);

  const { data } = response.json();
  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.end();
});

test('should remove saved wallet', async (t) => {
  const wallets = await mock.createWallets(1);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'deleteWallet',
      address: wallets[0].getAddressEncoded(),
    },
  });

  t.equal(response.statusCode, 200);

  const { data } = response.json();
  t.equal(typeof data.address, 'string');

  t.end();
});

test('should fail to remove unsaved wallet', async (t) => {
  // const wallets = await mock.createWallets(1);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'deleteWallet',
      address: 'random_address',
    },
  });

  t.equal(response.statusCode, 200);

  const { code } = response.json();
  t.equal(code, 'not_found');

  t.end();
});

test('should recover a wallet', async (t) => {
  // const wallets = await mock.createWallets(1);
  const wallet = new Wallet();
  wallet.generate();

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'recoverWallet',
      privateKey: wallet.getPrivateKeyHex(),
      label: 'Recovered wallet',
    },
  });

  t.equal(response.statusCode, 200);

  const { data } = response.json();

  t.equal(typeof data.privateKey, 'string');
  t.equal(typeof data.publicKey, 'string');
  t.equal(typeof data.address, 'string');

  t.end();

  await Wallet.clearAll();
});

test('should not recover a wallet without private key', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'recoverWallet',
      privateKey: 'notAPrivateKey',
      label: 'Not key',
    },
  });

  // console.log(response)
  t.equal(response.statusCode, 200);
  t.end();

  await Wallet.clearAll();
});
