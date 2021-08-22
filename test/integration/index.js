const { test } = require('tap');

const build = require('../../app');
const { runAction } = require('../../actions');

const { ErrorCode } = require('../../util/rpc');

// FIXME: Test when there is public endpoint with "required" fields
// test('cannot call action with failed pre-validation', async (t) => {
//   const app = build();

//   const response = await app.inject({
//     method: 'POST',
//     url: '/',
//     payload: {
//       action: 'addPeer',
//     },
//   });

//   const { errors, code, message } = response.json();

//   t.ok(Array.isArray(errors));
//   t.equal(code, ErrorCode.InvalidArgument);
//   t.equal(typeof (message), 'string');

//   t.equal(response.statusCode, 200, 'returns a status code of 200');
//   t.end();
// });

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
