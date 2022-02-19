const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');
const Block = require('../../models/block');
const { deserializeBuffer, serializeBuffer } = require('../../util/serialize');
const { randomPassword } = require('../../util/mock');

test('should create a verified transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  await transaction.sign(sender.getPrivateKey());

  const { length } = transaction.getSignature();

  t.equal(length >= 102 || length <= 104, true, 'signature length between 102 and 104');
  t.equal(transaction.verify(), true, 'transaction verified after signed');
  t.end();
});

test('transaction with same sender and receiver is invalid', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), sender.getAddress(), 10,
  );

  await transaction.sign(sender.getPrivateKey());

  const errors = transaction.validate();
  t.equal(errors.length, 1);
  t.not(transaction.verify());

  t.end();
});

test('transaction with negative value fee is invalid', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  transaction.setFee(-1);

  await transaction.sign(sender.getPrivateKey());

  const errors = transaction.validate();
  t.equal(errors.length, 1);
  t.not(transaction.verify());

  t.end();
});

test('transaction with unknown type is invalid', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  transaction.setType('unknown_type');

  await transaction.sign(sender.getPrivateKey());

  const errors = transaction.validate();
  t.equal(errors.length, 1);
  t.not(transaction.verify());

  t.end();
});

test('transaction with amount 0 or smaller is invalid', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transactionZero = new Transaction(sender.getPublicKey(), receiver.getAddress(), 0);
  await transactionZero.sign(sender.getPrivateKey());

  const zeroErrors = transactionZero.validate();
  t.ok(zeroErrors.length > 0, 'error when transaction amount is zero');
  t.not(transactionZero.verify());

  const transactionNegative = new Transaction(sender.getPublicKey(), receiver.getAddress(), 0);
  await transactionNegative.sign(sender.getPrivateKey());

  const negativeErrors = transactionNegative.validate();
  t.ok(negativeErrors.length > 0, 'error when transaction amount less than zero');
  t.not(transactionNegative.verify());

  t.end();
});

test('should have ID for transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 20);
  t.equal(transaction.getId().length, 32);

  t.end();
});

test('should fail verification with none or invalid transaction signature', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  // const { privateKey } = sender.getKeys();
  t.equal(transaction.verify(), false, 'transaction unverified before signing');

  await transaction.sign(sender.getPrivateKey());

  t.equal(transaction.verify(), true, 'transaction verified after signing');

  // Tamper signature byte
  transaction.signature[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(transaction.verify(), false, 'fail verification with incorrect signature');
  t.end();
});

test('should not be valid when signed with incorrect private key', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const otherWallet = new Wallet();
  await otherWallet.generate();

  const invalidAddress = deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7bafc');
  const transaction = new Transaction(
    wallet.getPublicKey(), invalidAddress, 55,
  );

  await transaction.sign(otherWallet.getPrivateKey());

  t.equal(transaction.verify(), false, 'invalid sign key');
  t.end();
});

test('should fail verification with invalid wallet address', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const invalidAddress = deserializeBuffer('0x003a5e292ca07ae3490e6d56fcb8516abca32d197392b7baf0');

  const transaction = new Transaction(
    sender.getPublicKey(), invalidAddress, 10,
  );
  await transaction.sign(sender.getPrivateKey());

  t.equal(transaction.verify(), false, 'invalid address to send');
  t.end();
});

test('have correct hash data for transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    20,
    Transaction.Type.Send,
  );

  transaction.setFee(5n);

  const data = JSON.parse(transaction.hashData());

  const results = [
    { key: 'version', value: 1 },
    { key: 'senderKey', value: serializeBuffer(sender.getPublicKey()) },
    { key: 'receiverAddress', value: serializeBuffer(receiver.getAddress()) },
    { key: 'amount', value: '20n' },
    { key: 'time', value: transaction.getTime() },
    { key: 'type', value: Transaction.Type.Send },
    { key: 'fee', value: '5n' },
  ];

  // Order of keys is important to ensure hash has same output
  Object.keys(data).forEach((key, index) => {
    t.equal(key, results[index].key);
    t.equal(data[key], results[index].value);
  });

  t.equal(data.signature, undefined);

  t.end();
});

test('have correct hash data for transaction with no sender', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    null,
    receiver.getAddress(),
    20,
    Transaction.Type.Send,
  );

  const data = JSON.parse(transaction.hashData());

  const results = [
    { key: 'version', value: 1 },
    { key: 'senderKey', value: null },
    { key: 'receiverAddress', value: serializeBuffer(receiver.getAddress()) },
    { key: 'amount', value: '20n' },
    { key: 'time', value: transaction.getTime() },
    { key: 'type', value: Transaction.Type.Send },
    { key: 'fee', value: '0n' },
  ];

  // Order of keys is important to ensure hash has same output
  Object.keys(data).forEach((key, index) => {
    t.equal(key, results[index].key);
    t.equal(data[key], results[index].value);
  });

  t.equal(data.signature, undefined);

  t.end();
});

test('have correct hash data for coinbase transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(null, receiver.getAddress(), 50);
  const data = JSON.parse(transaction.hashData());

  const results = [
    { key: 'version', value: 1 },
    { key: 'senderKey', value: null },
    { key: 'receiverAddress', value: serializeBuffer(receiver.getAddress()) },
    { key: 'amount', value: '50n' },
    { key: 'time', value: transaction.getTime() },
    { key: 'type', value: Transaction.Type.Send },
    { key: 'fee', value: '0n' },
  ];

  // Order of keys is important to ensure hash has same output
  Object.keys(data).forEach((key, index) => {
    t.equal(key, results[index].key);
    t.equal(data[key], results[index].value);
  });
  t.end();
});

test('save and load transaction', async (t) => {
  // const block = mock.blockWithTransactions(3);
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const coinbase = new Transaction(null, receiver.getAddress(), 10);

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 20);
  await transaction.sign(sender.getPrivateKey());

  await coinbase.save();
  const result = await transaction.save();

  t.not(result, null);

  const loadedCoinbase = await Transaction.load(coinbase.getId());
  t.ok(coinbase.getReceiverAddress().equals(loadedCoinbase.getReceiverAddress()));
  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());
  t.equal(loadedCoinbase.getSenderKey(), null);
  t.equal(loadedCoinbase.getSignature(), null);

  const loadedTransaction = await Transaction.load(transaction.getId());

  t.ok(coinbase.getReceiverAddress().equals(loadedCoinbase.getReceiverAddress()));
  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());

  t.ok(transaction.getSenderKey().equals(loadedTransaction.getSenderKey()));
  t.ok(transaction.getSignature().equals(loadedTransaction.getSignature()));

  await Transaction.clearAll();

  t.end();
});

test('unable to load unsaved transaction', async (t) => {
  // const block = mock.blockWithTransactions(3);
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 20);

  const loaded = await Transaction.load(transaction.getId());
  t.equal(loaded, null);

  t.end();
});

test('save pending transactions', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const numOfTransactions = 3;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 33);

    await transaction.sign(sender.getPrivateKey());
    await transaction.saveAsPending();
  }

  const loadedTransactions = await Transaction.loadPending();
  t.equal(loadedTransactions.length, 3);

  await Transaction.clearAllPending();

  const deleted = await Transaction.loadPending();
  t.equal(deleted.length, 0);

  t.end();
});

test('check confirmed transaction is saved', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 665);
  await transaction.sign(sender.getPrivateKey());

  let isSaved = await transaction.isSaved();
  t.equal(isSaved, false);

  await transaction.save();
  isSaved = await transaction.isSaved();
  t.equal(isSaved, true);

  await Transaction.clearAll();

  t.end();
});

test('does not accept confirmed transaction as pending transaction', async (t) => {
  const numOfBlocks = 5;
  Chain.mainChain = await mock.chainWithBlocks(numOfBlocks, 3);

  const chain = Chain.mainChain;

  const blockHash = chain.getBlockHeader(3).getHash();
  const block = await Block.load(blockHash);

  const chosenTransaction = block.getTransaction(2);

  const isSaved = await chosenTransaction.isSaved();
  t.equal(isSaved, true);

  const result = await chosenTransaction.saveAsPending();

  t.equal(result, false);

  await Chain.clearMain(chain);
  await Transaction.clearAllPending();
  t.end();
});

test('correct push data', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 20);
  await transaction.sign(sender.getPrivateKey());

  const pushData = transaction.toPushData();

  const fields = ['senderKey', 'address', 'amount', 'signature', 'time'];
  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(pushData, field));
  });

  t.end();
});

test('to and from transaction object', async (t) => {
  const transaction = await mock.transaction();

  const data = transaction.toObject();

  const loaded = Transaction.fromObject(data);

  t.ok(loaded.getId().equals(transaction.getId()));
  t.ok(loaded.getSenderKey().equals(transaction.getSenderKey()));
  t.ok(loaded.getSignature().equals(transaction.getSignature()));
  t.ok(loaded.getReceiverAddress().equals(transaction.getReceiverAddress()));

  t.equal(loaded.getVersion(), transaction.getVersion());
  t.equal(loaded.getTime(), transaction.getTime());
  t.equal(loaded.getAmount(), transaction.getAmount());
  t.equal(loaded.hashData(), transaction.hashData());
  t.equal(loaded.getFee(), transaction.getFee());

  t.end();
});

test('to and from transaction array', async (t) => {
  const numOfTransactions = 4;

  const transactions = await Promise.all(
    Array(numOfTransactions).fill(mock.transaction()),
  );

  const data = Transaction.toArray(transactions);
  t.equal(data.length, numOfTransactions);

  const loaded = Transaction.fromArray(data);
  t.equal(loaded.length, numOfTransactions);

  t.ok(loaded[0].getId().equals(transactions[0].getId()));
  t.end();
});

test('load pending transactions', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const numOfTransactions = 4;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 97);
    await transaction.sign(sender.getPrivateKey());

    await transaction.saveAsPending();
  }

  const pendingTransactions = await Transaction.loadPending();
  t.equal(pendingTransactions.length, numOfTransactions);

  await Transaction.clearAll();

  t.end();
});

test('check if transaction is existing saved transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  await transaction.sign(sender.getPrivateKey());

  t.equal(await transaction.isSaved(), false);

  await transaction.save();
  t.equal(await transaction.isSaved(), true);

  t.end();
});

test('check transaction is coinbase', async (t) => {
  const numOfTransactions = 3;
  const block = await mock.blockWithTransactions(3);

  for (let i = 0; i < numOfTransactions; i += 1) {
    // Only first transaction is coinbase
    const isFirstTransaction = (i === 0);
    t.equal(block.getTransaction(i).isCoinbase(), isFirstTransaction);
  }

  t.end();
});

test('coinbase only valid when correct transaction type', async (t) => {
  const block = await mock.blockWithTransactions(3);

  t.equal(block.getTransaction(0).isCoinbase(), true);

  block.transactions[0].setType(Transaction.Type.Send);
  t.equal(block.getTransaction(0).isCoinbase(), false);

  t.end();
});

test('sign transaction only when wallet password is correct', async (t) => {
  const correctPassword = randomPassword();
  const incorrectPassword = randomPassword();

  const sender = new Wallet();
  await sender.generate(correctPassword);

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddress(), 10,
  );

  t.equal(await transaction.sign(sender.getPrivateKey(), incorrectPassword), false);
  t.equal(await transaction.sign(sender.getPrivateKey(), correctPassword), true);

  t.end();
});
