const { test } = require('tap');

const build = require('../../app');

const { runAction } = require('../../actions');
const Wallet = require('../../models/wallet');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

test('cannot use unavailable action', async (t) => {
  const { code } = await runAction({
    action: 'iAmFree',
  });

  t.equal(code, ErrorCode.Unimplemented);
  t.end();
});

test('cannot call empty action', async (t) => {
  const { code } = await runAction({
    action: null,
  });

  t.equal(code, ErrorCode.InvalidArgument);
  t.end();
});

test('cannot call with empty options', async (t) => {
  const { code } = await runAction();

  t.equal(code, ErrorCode.InvalidArgument);
  t.end();
});

test('cannot inject hex value to string params', async (t) => {
  const label = '0x902bca36';

  const { code, data } = await runAction({
    action: 'createWallet',
    label,
    password: 'SQ6QviNanZM3',
  });

  t.equal(code, SuccessCode);
  t.equal(data.label, label);

  await Wallet.clearAll();

  t.end();
});
