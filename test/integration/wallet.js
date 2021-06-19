const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const app = require('../../app')();

test('list all wallet', async (t) => {
  await mock.createWallets(3);

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'listWallets',
    },
  });

  t.equal(response.statusCode, 200, 'returns a status code of 200');

  const { data } = response.json();
  t.equal(data.length, 3);

  t.equal(typeof data[0].label, 'string');
  t.equal(typeof data[0].privateKey, 'string');
  t.equal(typeof data[0].publicKey, 'string');

  Wallet.clearAll();

  t.end();
});
