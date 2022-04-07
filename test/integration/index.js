const { test } = require('tap');
const bent = require('bent');

const build = require('../../app');

const { runAction } = require('../../actions');
const Wallet = require('../../models/wallet');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

// TODO:
test('show a welcome message', async (t) => {
  // const app = build();

  // t.teardown(() => app.close());

  // app.listen(0, async (err) => {
  //   // t.error(err);

  //   // const getJSON = bent('json')
  //   // let obj = await getJSON(`http://localhost:${app.server.address().port}`);
  //   // console.log(obj);

  //   t.end();
  // });
});

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

test('does not inject hex value to string params', async (t) => {
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

test('send response in compressed jsonpack request', (t) => {
  const app = build();

  t.teardown(() => app.close());

  app.listen(0, async (err) => {
    t.error(err);
    const { port } = app.server.address();

    const post = bent(`http://127.0.0.1:${port}?format=jsonpack`, 'POST', 'string', 200);
    const response = await post('', { action: 'nodeInfo' });

    t.ok(response.startsWith('data|'));
    t.end();
  });
});
