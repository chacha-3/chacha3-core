const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const actions = require('../../actions');
const { options } = require('yargs');

test('create a transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const { permission, handler } = actions.createTransaction;

  const { data, code } = await handler({
    key: sender.getPrivateKey().toString('hex'),
    address: receiver.getAddressEncoded(),
    amount: 10,
    password: '',
  });

  t.equal(permission, 'public'); // TODO: Change later
  t.equal(code, 'ok');

  await Wallet.clearAll();

  t.end();
});
