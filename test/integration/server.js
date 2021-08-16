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

  const { error, data, code } = response.json();

  t.equal(error, undefined);
  t.equal(typeof (data), 'object');
  t.equal(code, 'ok');

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

  const { code, error } = response.json();

  t.equal(error, 'Out of coffee');
  t.equal(code, 'internal');

  t.end();
});
