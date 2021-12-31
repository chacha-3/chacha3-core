const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const Chain = require('../../models/chain');

const { SuccessCode, ErrorCode } = require('../../util/rpc');

const { runAction } = require('../../actions');
const { serializeBuffer } = require('../../util/serialize');
const Block = require('../../models/block');

test('create a transaction with sufficient balance', async (t) => {
  const password = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(password);

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1, sender);

  const { code, data } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    receiverAddress: receiver.getAddressEncoded(),
    amount: 20,
    password,
  });

  t.equal(code, SuccessCode);

  t.ok(Object.prototype.hasOwnProperty.call(data, 'id'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'signature'));
  // TODO: More check

  await Chain.clearMain();
  await Transaction.clearAllPending();

  t.end();
});

test('unable to create a transaction with incorrect password', async (t) => {
  const correctPassord = mock.randomPassword();
  const incorrectPassword = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(correctPassord);

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1, sender);

  const { code } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    receiverAddress: receiver.getAddressEncoded(),
    amount: 20,
    password: incorrectPassword,
  });

  t.equal(code, ErrorCode.PermissionDenied);

  await Chain.clearMain();
  await Transaction.clearAllPending();

  t.end();
});

test('create a transaction with selected wallet', async (t) => {
  const password = mock.randomPassword();

  const [sender] = await mock.createWallets(1, password);
  await Wallet.setSelected(sender.getAddress());

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1, sender);

  const { code, data } = await runAction({
    action: 'createTransaction',
    receiverAddress: receiver.getAddressEncoded(),
    amount: 20,
    password,
  });

  t.equal(code, SuccessCode);

  t.ok(Object.prototype.hasOwnProperty.call(data, 'id'));
  t.ok(Object.prototype.hasOwnProperty.call(data, 'signature'));
  // TODO: More check

  await Wallet.clearAll();
  await Chain.clearMain();

  await Transaction.clearAllPending();

  t.end();
});

test('show info for transaction', async (t) => {
  const password = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(password);

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 3);

  const selectedHeader = Chain.mainChain.getBlockHeader(2);
  const loadedBlock = await Block.load(selectedHeader.getHash());

  const selectedTransaction = loadedBlock.getTransaction(2);

  const { code, data } = await runAction({
    action: 'transactionInfo',
    id: serializeBuffer(selectedTransaction.getId()),
  });

  t.equal(code, SuccessCode);
  t.equal(data.id, serializeBuffer(selectedTransaction.getId()));
  // TODO: More field check

  await Chain.clearMain();
  t.end();
});

test('should not have info for unsaved transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPrivateKey(), receiver.getAddress(), 10000);

  const { code, data } = await runAction({
    action: 'transactionInfo',
    id: serializeBuffer(transaction.getId()),
  });

  t.equal(code, ErrorCode.NotFound);

  await Chain.clearMain();
  t.end();
});

test('create show error for invalid transaction', async (t) => {
  const password = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(password);

  Chain.mainChain = await mock.chainWithBlocks(3, 1, sender);

  // Invalid transaction Same sender and receiver
  const { code } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    receiverAddress: sender.getAddressEncoded(),
    amount: 20,
    password,
  });

  t.equal(code, ErrorCode.InvalidArgument);

  await Chain.clearMain();

  t.end();
});

test('unable to create a transaction with insufficient balance', async (t) => {
  const password = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(password);

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const { code, data, message } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    receiverAddress: receiver.getAddressEncoded(),
    amount: 20,
    password,
  });

  t.equal(code, ErrorCode.FailedPrecondition);

  await Chain.clearMain();

  t.end();
});

test('unable to create a transaction with incorrect password', async (t) => {
  const correctPassword = mock.randomPassword();
  const incorrectPassword = mock.randomPassword();

  const sender = new Wallet();
  await sender.generate(correctPassword);

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(3, 1);

  const { code } = await runAction({
    action: 'createTransaction',
    key: sender.getPrivateKeyHex(),
    receiverAddress: receiver.getAddressEncoded(),
    amount: 20,
    password: incorrectPassword,
  });

  t.equal(code, ErrorCode.PermissionDenied);
  await Chain.clearMain();

  t.end();
});

test('should push valid transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 38);
  await transaction.sign(sender.getPrivateKey());

  const { code } = await runAction({
    action: 'pushTransaction',
    key: serializeBuffer(transaction.getSenderKey()),
    receiverAddress: serializeBuffer(transaction.getReceiverAddress()),
    amount: transaction.getAmount().toString(),
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

test('should fail to push invalid transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const transaction = new Transaction(sender.getPublicKey(), sender.getAddress(), 10000);
  await transaction.sign(sender.getPrivateKey());

  /// Same sender and receiver
  const { code } = await runAction({
    action: 'pushTransaction',
    key: serializeBuffer(transaction.getSenderKey()),
    receiverAddress: serializeBuffer(transaction.getReceiverAddress()),
    amount: transaction.getAmount().toString(),
    signature: serializeBuffer(transaction.getSignature()),
    time: transaction.getTime(),
    version: transaction.getVersion(),
  });

  t.equal(code, ErrorCode.InvalidArgument);

  const pendingTransactions = await Transaction.loadPending();
  t.equal(pendingTransactions.length, 0);

  await Transaction.clearAll();

  t.end();
});

test('should fail to push unverified transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  // Not signed
  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10000);

  const { code } = await runAction({
    action: 'pushTransaction',
    key: serializeBuffer(transaction.getSenderKey()),
    receiverAddress: serializeBuffer(transaction.getReceiverAddress()),
    amount: transaction.getAmount().toString(),
    signature: serializeBuffer(transaction.getSignature()),
    time: transaction.getTime(),
    version: transaction.getVersion(),
  });

  t.equal(code, ErrorCode.InvalidArgument);

  const pendingTransactions = await Transaction.loadPending();
  t.equal(pendingTransactions.length, 0);

  await Transaction.clearAll();

  t.end();
});

test('get pending transactions', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const numOfTransactions = 3;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 97);
    await transaction.sign(sender.getPrivateKey());

    await transaction.saveAsPending();
  }

  const { data, code } = await runAction({
    action: 'pendingTransactions',
  });

  t.equal(code, SuccessCode);

  t.equal(data.length, 3);

  await Transaction.clearAll();

  t.end();
});

test('clear pending transactions', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const numOfTransactions = 3;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 97);
    await transaction.sign(sender.getPrivateKey());

    await transaction.saveAsPending();
  }

  const { data, code } = await runAction({
    action: 'clearPendingTransactions',
  });

  t.equal(code, SuccessCode);

  const pending = await Transaction.loadPending();
  t.equal(pending.length, 0);

  t.end();
});
