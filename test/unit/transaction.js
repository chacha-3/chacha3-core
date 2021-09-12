const { test } = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');
const Block = require('../../models/block');
// const { expect } = chai;
// chai.use(dirtyChai);

test('should create a verified transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddressEncoded(), 10,
  );

  // const { privateKey } = sender.getKeys();
  transaction.sign(sender.getPrivateKeyObject());

  const { length } = transaction.getSignature();

  t.equal(length >= 102 || length <= 104, true, 'signature length between 102 and 104');
  t.equal(transaction.verify(), true, 'transaction verified after signed');
  t.end();
});

test('should have ID for transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);
  t.equal(transaction.getId().length, 32);

  t.end();
});

test('should fail verification with none or invalid transaction signature', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddressEncoded(), 10,
  );

  // const { privateKey } = sender.getKeys();
  t.equal(transaction.verify(), false, 'transaction unverified before signing');

  transaction.sign(sender.getPrivateKeyObject());

  t.equal(transaction.verify(), true, 'transaction verified after signing');

  // Tamper signature byte
  transaction.signature[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(transaction.verify(), false, 'fail verification with incorrect signature');
  t.end();
});

test('should not be valid when signed with incorrect private key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const otherWallet = new Wallet();
  otherWallet.generate();

  const transaction = new Transaction(
    wallet.getPublicKey(), '114mRHezWdQx7MMTJ8QFokoqUraoB4ivKF', 55,
  );

  transaction.sign(otherWallet.getPrivateKeyObject());

  t.equal(transaction.verify(), false, 'invalid sign key');
  t.end();
});

test('should fail verification with invalid wallet address', (t) => {
  const sender = new Wallet();
  sender.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), '114mRHezWdQx7MMTJ8QFokoqUraoB4ivK9', 10,
  );
  transaction.sign(sender.getPrivateKeyObject());

  t.equal(transaction.verify(), false, 'invalid address to send');
  t.end();
});

test('have correct hash data for transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);

  const hashData = JSON.parse(transaction.hashData());

  t.equal(hashData.version, 1);
  t.equal(hashData.receiverAddress, receiver.getAddressEncoded().toString('hex')); // FIXME: Why hex?
  t.equal(hashData.amount, 20);
  t.equal(hashData.senderKey, sender.getPublicKey().toString('hex'));

  t.ok(hashData.time > 0);

  t.end();
});

test('have correct hash data for transaction with no sender', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(null, receiver.getAddressEncoded(), 20);

  const hashData = JSON.parse(transaction.hashData());
  t.equal(hashData.senderKey, undefined);

  t.end();
});

test('have correct hash data for coinbase transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(null, receiver.getAddressEncoded(), 50);

  const hashData = JSON.parse(transaction.hashData());

  t.equal(hashData.version, 1);
  t.equal(hashData.receiverAddress, receiver.getAddressEncoded().toString('hex'));
  t.equal(hashData.amount, 50);
  t.equal(hashData.senderKey, undefined);

  t.end();
});

test('save and load transaction', async (t) => {
  // const block = mock.blockWithTransactions(3);
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const coinbase = new Transaction(null, receiver.getAddressEncoded(), 10);

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);
  transaction.sign(sender.getPrivateKeyObject());

  await Transaction.save(coinbase);
  const result = await Transaction.save(transaction);

  t.not(result, null);

  const loadedCoinbase = await Transaction.load(coinbase.getId());

  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getReceiverAddress(), loadedCoinbase.getReceiverAddress());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());
  t.equal(loadedCoinbase.getSenderKey(), null);
  t.equal(loadedCoinbase.getSignature(), null);

  const loadedTransaction = await Transaction.load(transaction.getId());

  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getReceiverAddress(), loadedCoinbase.getReceiverAddress());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());

  t.ok(transaction.getSenderKey().equals(loadedTransaction.getSenderKey()));
  t.ok(transaction.getSignature().equals(loadedTransaction.getSignature()));

  await Transaction.clearAll();

  t.end();
});

test('unable to load unsaved transaction', async (t) => {
  // const block = mock.blockWithTransactions(3);
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);

  const loaded = await Transaction.load(transaction.getId());
  t.equal(loaded, null);

  t.end();
});

test('save pending transactions', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const numOfTransactions = 3;
  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 33);
    transaction.sign(sender.getPrivateKeyObject());

    await Transaction.save(transaction, true);
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
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 665);
  transaction.sign(sender.getPrivateKeyObject());

  let isSaved = await transaction.isSaved();
  t.equal(isSaved, false);

  await Transaction.save(transaction);
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

  let isSaved = await chosenTransaction.isSaved();

  const result = await Transaction.save(chosenTransaction, true);
  // isSaved = await chosenTransaction.isSaved();

  t.equal(result, null);

  await Chain.clear(chain);
  t.end();
});

test('correct push data', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);
  transaction.sign(sender.getPrivateKeyObject());

  const pushData = transaction.toPushData();

  const fields = ['key', 'address', 'amount', 'signature', 'time'];
  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(pushData, field));
  });

  t.end();
});

test('to and from transaction object', async (t) => {
  const transaction = mock.transaction();

  const data = transaction.toObject();

  const loaded = Transaction.fromObject(data);

  t.ok(loaded.getId().equals(transaction.getId()));
  t.ok(loaded.getSenderKey().equals(transaction.getSenderKey()));
  t.ok(loaded.getSignature().equals(transaction.getSignature()));

  t.equal(loaded.getReceiverAddress(), transaction.getReceiverAddress());
  t.equal(loaded.getVersion(), transaction.getVersion());
  t.equal(loaded.getTime(), transaction.getTime());
  t.equal(loaded.getAmount(), transaction.getAmount());
  t.equal(loaded.hashData(), transaction.hashData());

  t.end();
});

test('load pending transactions', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const numOfTransactions = 4;

  for (let i = 0; i < numOfTransactions; i += 1) {
    const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 97);
    transaction.sign(sender.getPrivateKeyObject());

    await Transaction.save(transaction, true);
  }

  const pendingTransactions = await Transaction.loadPending();
  t.equal(pendingTransactions.length, numOfTransactions);

  await Transaction.clearAll();

  t.end();
});
