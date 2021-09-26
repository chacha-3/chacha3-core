const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode, ErrorCode } = require('../../util/rpc');

const app = require('../../app')();

// Test for the error handler
test('should be able to call public actions', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'nodeInfo',
    },
    // headers: {
    //   'bong-port': 4002,
    //   'bong-chain-work': 5,
    //   'bong-chain-length': 5,
    // },
  });

  const { data, code } = response.json();

  t.equal(typeof (data), 'object');
  t.equal(code, SuccessCode);

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
  t.equal(code, ErrorCode.Unauthenticated);
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
  t.equal(code, ErrorCode.Internal);
  t.equal(message, 'Out of coffee');

  t.end();
});
