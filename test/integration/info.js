const { test } = require('tap');

const mock = require('../../util/mock');
const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

const build = require('../../app');

test('should get node info', async (t) => {
  await mock.createWallets(3);

  const { data } = await runAction({
    action: 'nodeInfo',
  });

  t.ok(Object.prototype.hasOwnProperty.call(data, 'version'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'time'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'port'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'chainLength'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'chainWork'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'nonce'));

  await Wallet.clearAll();

  t.end();
});

test('should ping own node', async (t) => {
  const { code, message } = await runAction({
    action: 'ping',
  });

  t.equal(code, SuccessCode);
  t.equal(message, 'Pong');

  t.end();
});

// Require testing server
test('should ping a node address', (t) => {
  t.plan(2);

  const app = build();

  t.teardown(() => app.close());

  app.listen(0, async (err) => {
    t.error(err);

    // request({
    //   method: 'GET',
    //   url: 'http://localhost:' + fastify.server.address().port
    // }, (err, response, body) => {
    //   t.error(err)
    //   t.equal(response.statusCode, 200)
    //   t.equal(response.headers['content-type'], 'application/json; charset=utf-8')
    //   t.same(JSON.parse(body), { hello: 'world' })
    // })
    const { code, message } = await runAction({
      action: 'pingNode',
      address: '127.0.0.1',
      port: app.server.address().port,
    });
    t.equal(code, SuccessCode);
  });

  // console.log(code, message);
  // t.equal(code, SuccessCode);
  // t.equal(message, 'Pong');

  // t.end();
});
