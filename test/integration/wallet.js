const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const actions = require('../../actions');
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

  console.log(wallets[0].getAddressEncoded());

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

  console.log(response.body);
  // t.equal(response.statusCode, 200);

  // const { data } = response.json();
  // t.equal(typeof data.address, 'string');

  t.end();
});

