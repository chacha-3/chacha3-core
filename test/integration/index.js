const { test } = require('tap');

const build = require('../../app');
const { runAction } = require('../../actions');

const { ErrorCode } = require('../../util/rpc');

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
