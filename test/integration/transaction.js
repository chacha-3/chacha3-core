const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');

const { SuccessCode } = require('../../util/rpc');

const { runAction } = require('../../actions');
const { options } = require('yargs');

test('create a transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const { data, message } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    address: receiver.getAddressEncoded(),
    amount: 20,
  });

  await Transaction.clearAll();

  t.end();
});

test('push transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 38);
  transaction.sign(sender.getPrivateKeyObject());

  const { code } = await runAction({
    action: 'pushTransaction',
    key: transaction.getSenderKey().toString('hex'),
    address: transaction.getReceiverAddress(),
    amount: transaction.getAmount(),
    signature: transaction.getSignature().toString('hex'),
    time: transaction.getTime(),
    version: transaction.getVersion(),
  });

  t.equal(code, SuccessCode);

  const pendingTransactions = await Transaction.loadPending();
  t.equal(pendingTransactions.length, 1);

  await Transaction.clearAll();

  t.end();
});

test('get pending transactions', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const numOfTransactions = 3;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 97);
    transaction.sign(sender.getPrivateKeyObject());

    await Transaction.save(transaction, true);
  }

  const { data, code } = await runAction({
    action: 'pendingTransactions',
  });

  t.equal(code, SuccessCode);
  console.log(data);
  t.equal(data.length, 3);

  await Transaction.clearAll();

  t.end();
});
