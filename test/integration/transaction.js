const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const Chain = require('../../models/chain');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

const { runAction } = require('../../actions');
const { options } = require('yargs');
const { serializeBuffer } = require('../../util/serialize');

test('create a transaction with sufficient balance', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1, sender);

  const { code, data, message } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    address: receiver.getAddressEncoded(),
    amount: 20,
  });

  t.equal(code, SuccessCode);

  await Transaction.clearAll();

  t.end();
});

test('unable to create a transaction with insufficient balance', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const { code, data, message } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    address: receiver.getAddressEncoded(),
    amount: 20,
  });

  t.equal(code, ErrorCode.FailedPrecondition);

  await Transaction.clearAll();

  t.end();
});

test('push transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 38);
  transaction.sign(sender.getPrivateKeyObject());

  const { code } = await runAction({
    action: 'pushTransaction',
    key: serializeBuffer(transaction.getSenderKey()),
    address: serializeBuffer(transaction.getReceiverAddress()),
    amount: transaction.getAmount(),
    signature: serializeBuffer(transaction.getSignature()),
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
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 97);
    transaction.sign(sender.getPrivateKeyObject());

    await transaction.save(true);
  }

  const { data, code } = await runAction({
    action: 'pendingTransactions',
  });

  t.equal(code, SuccessCode);

  t.equal(data.length, 3);

  await Transaction.clearAll();

  t.end();
});
