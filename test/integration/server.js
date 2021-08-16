const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const app = require('../../app')();

// Test for the error handler
test('should be able to call public actions', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'nodeInfo',
    },
  });

  const { data, code } = response.json();

  t.equal(typeof (data), 'object');
  t.equal(code, 'ok');

  t.end();
});

test('should not be able to call authenticated actions', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'listWallets',
    },
  });

  const { data, code, message } = response.json();
  t.equal(code, 'unauthenticated');
  t.equal(data, undefined);
  t.equal(typeof (message), 'string');

  t.end();
});

// Test for the error handler
test('should not brew coffee with a teapot', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'teapot',
    },
  });

  const { code, message } = response.json();
  t.equal(code, 'internal');
  t.equal(message, 'Out of coffee');

  t.end();
});
