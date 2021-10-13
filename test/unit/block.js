const { test } = require('tap');
const assert = require('assert');
const crypto = require('crypto');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const mock = require('../../util/mock');
const Chain = require('../../models/chain');
const { deserializeBuffer } = require('../../util/serialize');
const { randomNumberBetween } = require('../../util/math');
const Header = require('../../models/header');

test('should validate coinbase', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.equal(block.validateCoinbase(), true, 'mined block has validated coinbase');
  // t.equal(block.verify(), true, 'mined block is verified');

  t.end();
});

test('should have invalid coinbase when invalid address', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  const address = wallet.getAddress();
  address[5] += 20; // Tamper, should fail checksum

  block.addCoinbase(address);
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.equal(await block.validateCoinbase(), false, 'mined block has invalid coinbase');
  // t.equal(block.verify(), false, 'mined block has invalid coinbase');

  t.end();
});

test('should be not have verified block when invalid coinbase amount', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  const address = wallet.getAddress();

  block.addCoinbase(address);
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  block.transactions[0].amount = 99999;

  await block.mine();

  t.equal(await block.verifyCoinbase(), false, 'mined block has invalid coinbase');
  // t.equal(block.verify(), fverifyCoinbasealse, 'mined block has invalid coinbase');

  t.end();
});

test('should be not have verified block when fail coinbase validation', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  const address = wallet.getAddress();

  block.addCoinbase(address);
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  block.transactions[0].receiverAddress = crypto.randomBytes(32);

  await block.mine();

  t.equal(await block.verifyCoinbase(), false, 'mined block has invalid coinbase');
  // t.equal(block.verify(), false, 'mined block has invalid coinbase');

  t.end();
});

test('coinbase should not have signature and sender', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();

  const transaction = new Transaction(
    sender.getPrivateKey(),
    receiver.getAddress(),
    100,
  );

  transaction.sign(sender.getPrivateKey());

  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  block.addCoinbase(receiver.getAddress());
  block.addTransaction(transaction);

  await block.mine();

  t.equal(block.validateCoinbase(), true, 'Valid coinbase');

  // Remove coinbase
  block.transactions.shift();
  await block.mine();

  t.equal(block.validateCoinbase(), false, 'Invalid coinbase, has signature');

  t.end();
});

test('cannot add unsigned transaction to block', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();

  const transaction = new Transaction(
    sender.getPrivateKey(),
    receiver.getAddress(),
    100,
  );

  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  block.addCoinbase(receiver.getAddress());

  t.throws(() => { block.addTransaction(transaction); });

  t.end();
});

test('does not add same transaction twice', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  transaction.sign(sender.getPrivateKey());

  const resultFirst = block.addTransaction(transaction);
  const resultSecond = block.addTransaction(transaction);

  t.equal(resultFirst, true);
  t.equal(resultSecond, false);

  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.end();
});

test('get object representation of a block', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  const transaction1 = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  transaction1.sign(sender.getPrivateKey());

  block.addTransaction(transaction1);
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.end();
});

test('verify block with only coinbase has checksum', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  block.addCoinbase(receiver.getAddress());

  await block.mine();

  t.equal(block.verifyChecksum(), true);
  // t.equal(block.verify(), true); FIXME:

  t.end();
});

test('verify block with checksum', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  const transaction1 = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    410,
  );

  transaction1.sign(sender.getPrivateKey());

  block.addTransaction(transaction1);
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.equal(block.verifyChecksum(), true);
  // t.equal(block.verify(), true); FIXME:

  // Tamper checksum byte
  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(block.verifyChecksum(), false);
  // t.equal(block.verify(), false); FIXME:

  t.end();
});

test('checksum is updated when adding transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  let previousChecksum = null;

  for (let i = 0; i < 3; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddress(),
      200,
    );

    transaction.sign(sender.getPrivateKey());

    block.addTransaction(transaction);
    block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

    await block.mine();

    if (previousChecksum) {
      t.not(block.getHeader().getChecksum(), previousChecksum, 'Checksum is not the same');
    } else {
      previousChecksum = block.getHeader().getChecksum();
    }
  }

  t.end();
});

test('block is invalid when checksum is incorrect', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(block.verifyChecksum(), false, 'tampered block has invalid checksum');
  // t.equal(block.verify(), false, 'tampered block fails verification'); // FIXME:

  t.end();
});

test('block is invalid if adding transaction after mining', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await block.mine();

  t.equal(block.verifyHash(), true, 'mined block has verified hash');
  // t.equal(block.verify(), true, 'mined block is verified'); // FIXME:

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const addTransaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  addTransaction.sign(sender.getPrivateKey());

  // Tamper block. Add transaction without changes to checksum
  block.transactions.push(addTransaction);

  t.equal(block.verifyChecksum(), false, 'tampered transaction has invalid hash');
  // t.equal(block.verify(), false, 'tampered transaction is unverified'); // FIXME:

  t.end();
});

test('block is invalid if hash does not meet mining difficulty', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  // Set hash manually instead of mining block
  block.header.setHash(deserializeBuffer('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00'));

  t.equal(block.verifyHash(), false, 'invalid hash');
  // t.equal(block.verify(), false, 'invalid transaction is unverified'); // FIXME:

  t.end();
});

test('block is valid when does not have previously saved transaction', async (t) => {
  await mock.chainWithBlocks(3, 5);

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  const result = await block.verifyTransactions();
  t.equal(result, true);

  await Chain.clearMain();
  t.end();
});

// test('block is invalid when has previously saved transaction', async (t) => {
//   const chain = await mock.chainWithBlocks(3, 5);

//   const hash = chain.getBlockHeader(2).getHash();
//   const savedBlock = await Block.load(hash);

//   const randomSavedTransaction = savedBlock.getTransaction(4);

//   const block = new Block();
//   block.addTransaction(randomSavedTransaction);

//   const result = await block.verifyTransactions();
//   t.equal(result, false);

//   await Chain.clearMain();
//   t.end();
// });

test('block is invalid when has invalid transaction', async (t) => {
  const block = await mock.blockWithTransactions(4);

  // Tamper a transaction signature
  block.transactions[3].signature[3] += 5;

  const result = await block.verifyTransactions();
  t.equal(result, false);

  await Chain.clearMain();
  t.end();
});

test('add pending transaction to block', async (t) => {
  const transactions = mock.pendingTransactions(4);

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  const rejected = block.addPendingTransactions(transactions);

  t.equal(block.getTransactionCount(), 5);
  t.equal(rejected.length, 0);

  t.end();
});

test('reject pending transaction if already saved', async (t) => {
  const transactions = mock.pendingTransactions(4);

  const addedTransaction = transactions[2];

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  block.addTransaction(addedTransaction);

  const rejected = block.addPendingTransactions(transactions);

  t.equal(rejected.length, 1);
  t.ok(rejected[0].getId().equals(addedTransaction.getId()));

  t.equal(block.getTransactionCount(), 5);
  t.end();
});

test('correct block object format', async (t) => {
  const block = await mock.blockWithTransactions(3);
  const obj = block.toObject();

  t.ok(Object.prototype.hasOwnProperty.call(obj, 'header'));
  t.ok(typeof (obj.header), 'object');

  t.ok(Object.prototype.hasOwnProperty.call(obj, 'transactions'));
  t.equal(obj.transactions.length, 3);

  const loaded = Block.fromObject(obj);
  // t.equal(loaded.verify(), true); // FIXME:

  t.end();
});

test('save and load block', async (t) => {
  const block = await mock.blockWithTransactions(3);
  // t.equal(block.verify(), true);

  await block.save();

  const key = block.getHeader().getHash();
  const loaded = await Block.load(key);
  // t.equal(loaded.verify(), true);

  // Simple equality check
  // TODO: Add more checks
  t.ok(block.getHeader().getHash().equals(loaded.getHeader().getHash()));
  t.equal(block.getTransactionCount(), loaded.getTransactionCount());

  t.equal(block.getTransaction(0).getTime(), loaded.getTransaction(0).getTime());

  await Block.clearAll();

  t.end();
});

test('save and load block', async (t) => {
  const block = await mock.blockWithTransactions(3);
  // t.equal(block.verify(), true);

  await block.save();

  const key = block.getHeader().getHash();
  const loaded = await Block.load(key);
  // t.equal(loaded.verify(), true);

  // Simple equality check
  // TODO: Add more checks
  t.ok(block.getHeader().getHash().equals(loaded.getHeader().getHash()));
  t.equal(block.getTransactionCount(), loaded.getTransactionCount());

  t.equal(block.getTransaction(0).getTime(), loaded.getTransaction(0).getTime());

  await Block.clearAll();

  t.end();
});

test('does not load unsaved block', async (t) => {
  const block = await mock.blockWithTransactions(3);

  const loaded = await Block.load(block.getHeader().getHash());
  t.equal(loaded, null);

  await Block.clearAll();

  t.end();
});

test('delete saved block', async (t) => {
  const numOfTransactions = 3;

  const block = await mock.blockWithTransactions(numOfTransactions);
  await block.save();

  const randomTransaction = block.getTransaction(randomNumberBetween(0, numOfTransactions - 1));

  const key = block.getHeader().getHash();
  await Block.clear(key);

  const savedBlock = await Block.load(key);
  t.equal(savedBlock, null);

  const savedHeader = await Header.load(key);
  t.equal(savedHeader, null);

  const savedTransaction = await Transaction.load(randomTransaction.getId());
  t.equal(savedTransaction, null);

  t.end();
});

test('save block transactions', async (t) => {
  const numOfBlocks = 3;
  const block = await mock.blockWithTransactions(numOfBlocks);

  const ids = await block.saveTransactions();
  t.equal(ids.length, numOfBlocks);

  await Transaction.clearAll();
  t.end();
});

test('does not continue with block transaction deletion if not block found', async (t) => {
  const unsavedBlock = await mock.blockWithTransactions(3);
  await Block.clear(unsavedBlock.getHeader().getHash());

  t.end();
});

test('get genesis block', async (t) => {
  const block = Block.Genesis;

  // TODO: Check
  // t.equal(block.verify(), true);

  t.end();
});

test('block verify checks has no existing transactions', async (t) => {
  const block = await mock.blockWithTransactions(3);

  t.equal(await block.hasNoExistingTransactions(), true);

  await block.getTransaction(2).save();
  t.equal(await block.hasNoExistingTransactions(), false);

  await Block.clearAll();
  t.end();
});
