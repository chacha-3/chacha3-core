// require('../../util/env').setTestEnv();

const { test } = require('tap');
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
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 100);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyCoinbase(), true, 'mined block has valid coinbase');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), true, 'mined block has valid coinbase');

  await Chain.clearMain();
});

test('should have invalid coinbase when invalid address', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  const address = wallet.getAddress();
  address[5] += 20; // Tamper, should fail checksum

  block.addCoinbase(address);
  await block.mine(1);

  t.equal(await block.validateCoinbase(), false, 'mined block has invalid coinbase');
  t.end();
});

test('should have invalid coinbase when has fee', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() - 50);

  block.transactions[0].fee = 22n;

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyCoinbase(), false, 'mined block has invalid coinbase');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false, 'mined block has invalid coinbase');

  await Chain.clearMain();

  t.end();
});

test('should be not have verified block when invalid coinbase amount', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() - 50);

  block.transactions[0].amount = 10000000000000000000n;

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyCoinbase(), false, 'mined block has invalid coinbase');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false, 'mined block has invalid coinbase');

  await Chain.clearMain();

  t.end();
});

test('should have invalid coinbase when invalid transaction type', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  const address = wallet.getAddress();
  block.addCoinbase(address);

  block.transactions[0].type = Transaction.Type.Send; // Invalid type
  await block.mine(1);

  t.equal(await block.validateCoinbase(), false, 'mined block has invalid coinbase');
  t.end();
});

test('should be not have verified block when fail coinbase validation', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 50);

  // Tamper coinbase
  block.transactions[0].receiverAddress = crypto.randomBytes(32);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyCoinbase(), false, 'mined block has invalid coinbase');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false, 'mined block has invalid coinbase');

  await Chain.clearMain();
  t.end();
});

test('coinbase should not have signature and sender', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    100,
  );

  await transaction.sign(sender.getPrivateKey());

  block.addCoinbase(receiver.getAddress());
  block.addTransaction(transaction);

  await block.mine(1);

  t.equal(block.validateCoinbase(), true, 'Valid coinbase');

  // Remove coinbase
  block.transactions.shift();
  await block.mine(1);

  t.equal(block.validateCoinbase(), false, 'Invalid coinbase, has signature');

  t.end();
});

test('cannot add unsigned transaction to block', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();

  const transaction = new Transaction(
    sender.getPrivateKey(),
    receiver.getAddress(),
    100,
  );

  block.addCoinbase(receiver.getAddress());

  t.throws(() => { block.addTransaction(transaction); });

  t.end();
});

test('does not add same transaction twice', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  await transaction.sign(sender.getPrivateKey());

  const resultFirst = block.addTransaction(transaction);
  const resultSecond = block.addTransaction(transaction);

  t.equal(resultFirst, true);
  t.equal(resultSecond, false);

  await block.mine(1);

  t.end();
});

test('get object representation of a block', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  const transaction1 = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  await transaction1.sign(sender.getPrivateKey());

  block.addTransaction(transaction1);
  await block.mine(1);

  t.end();
});

test('verify that a block with only a coinbase has checksum', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  await block.mine(1);

  t.equal(block.verifyChecksum(), true);

  t.end();
});

test('verify block with checksum', async (t) => {
  const numOfBlocks = 3;

  const wallet = new Wallet();
  await wallet.generate();

  const chain = await mock.chainWithBlocks(numOfBlocks, 5, wallet);
  const previousHeader = chain.lastBlockHeader();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 100);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyChecksum(), true);
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), true);

  // Tamper checksum byte
  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(await block.verifyChecksum(), false);
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false);

  await chain.clearBlocks();
  t.end();
});

test('checksum is updated when adding transaction', async (t) => {
  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  let previousChecksum = null;

  for (let i = 0; i < 3; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddress(),
      200,
    );

    await transaction.sign(sender.getPrivateKey());

    block.addTransaction(transaction);
    await block.mine(1);

    if (previousChecksum) {
      t.not(block.getHeader().getChecksum(), previousChecksum, 'Checksum is not the same');
    } else {
      previousChecksum = block.getHeader().getChecksum();
    }
  }

  t.end();
});

test('unable to add transaction with invalid signature to block', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  await block.mine(1);

  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    200,
  );

  transaction.setSignature(crypto.randomBytes(32));

  const added = block.addTransaction(transaction);
  t.equal(added, false);

  t.end();
});

test('block is invalid when timestamp is before previous block timestamp', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() - 10000);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(block.verifyTimestamp(previousHeader), false, 'block with timestamp before previous block fails verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks - 1)), false);

  t.end();
});

test('block is valid only when previous hash matches', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());

  await block.mine(chain.getCurrentDifficulty());

  t.equal(block.verifyPrevious(previousHeader), true, 'block with correct previous hash passes verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks - 1)), true);

  t.end();
});

test('block is invalid it does not match previous hash', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(crypto.randomBytes(32));

  await block.mine(chain.getCurrentDifficulty());

  t.equal(block.verifyPrevious(previousHeader), false, 'block with invalid when previous hash does not match');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks - 1)), false);

  t.end();
});

test('block is invalid when timestamp is in the future', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 2000000);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(block.verifyTimestamp(previousHeader), false, 'block with timestamp in the future fails verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks - 1)), false);

  t.end();
});

test('block is invalid when coinbase reward is incorrect', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  const invalidReward = Block.InitialReward * 1000n;
  block.addCoinbase(wallet.getAddress(), invalidReward);

  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 2000000);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(block.verifyCoinbase(Chain.blockRewardAtIndex(numOfBlocks - 1)), false, 'block with invalid reward fails coinbase verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks - 1)), false);

  t.end();
});

test('block is invalid when hash does not meet target (mining difficult)', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress(), Chain.blockRewardAtIndex(numOfBlocks));
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 100);

  block.header.setHash(deserializeBuffer('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00'));

  t.equal(block.verifyHash(false), false, 'block with invalid hash fails coinbase verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false);

  t.end();
});

test('block is invalid when hash meet difficulty but is incorrect', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress(), Chain.blockRewardAtIndex(numOfBlocks));
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 100);

  block.header.setHash(deserializeBuffer('0x00000000000000000000ffffffffffffffffffffffffffffffffffffffffff00'));

  t.equal(block.verifyHash(), false, 'block with invalid hash fails coinbase verification');
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), false);

  t.end();
});

test('block is valid when does not have previously saved transaction', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const previousHeader = chain.lastBlockHeader();

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(previousHeader.getHash());
  block.header.setTime(previousHeader.getTime() + 100);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyTransactions(), true);
  t.equal(await block.verify(previousHeader, Chain.blockRewardAtIndex(numOfBlocks)), true);

  await Chain.clearMain();
  t.end();
});

test('block is invalid when has previously saved transaction', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const previousHeader = chain.lastBlockHeader();

  const hash = chain.getBlockHeader(2).getHash();
  const savedBlock = await Block.load(hash);

  const randomSavedTransaction = savedBlock.getTransaction(4);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  block.addTransaction(randomSavedTransaction);
  block.header.setTime(previousHeader.getTime() + 100);

  await block.mine(chain.getCurrentDifficulty());

  t.equal(await block.verifyTransactions(), false);

  const verified = await block.verify(
    block.getHeader().getPrevious(),
    Chain.blockRewardAtIndex(numOfBlocks),
  );

  t.equal(verified, false);

  await Chain.clearMain();
  t.end();
});

test('block is invalid when has invalid transaction', async (t) => {
  const block = await mock.blockWithTransactions(4);

  // Tamper a transaction signature
  block.transactions[3].signature[3] += 5;

  const result = await block.verifyTransactions();
  t.equal(result, false);

  await Chain.clearMain();
  t.end();
});

test('block is invalid when non-coinbase has type mine', async (t) => {
  const block = await mock.blockWithTransactions(4);

  block.transactions[3].type = Transaction.Type.Mine;

  const result = await block.verifyTransactions();
  t.equal(result, false);

  await Chain.clearMain();
  t.end();
});

test('add pending transaction to block', async (t) => {
  const transactions = await mock.pendingTransactions(4);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  const rejected = block.addPendingTransactions(transactions);

  t.equal(block.getTransactionCount(), 5);
  t.equal(rejected.length, 0);

  t.end();
});

test('does not add non-send transactions to pending', async (t) => {
  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  t.equal(block.getTransactionCount(), 1);

  const transaction = new Transaction(null, wallet.getAddress(), 100, Transaction.Type.Mine);
  await transaction.sign(wallet.getPrivateKey());

  const rejected = block.addPendingTransactions([transaction]);

  t.equal(block.getTransactionCount(), 1);
  t.equal(rejected.length, 1);

  t.equal(rejected[0].getType(), Transaction.Type.Mine);

  t.end();
});

test('reject pending transaction if already saved', async (t) => {
  const transactions = await mock.pendingTransactions(4);

  const addedTransaction = transactions[2];

  const wallet = new Wallet();
  await wallet.generate();

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
  // TODO:

  t.end();
});

test('save and load block', async (t) => {
  const block = await mock.blockWithTransactions(3);
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

test('get and verify genesis block', async (t) => {
  const block = Block.Genesis;

  const verified = await block.verify(
    null,
    Chain.blockRewardAtIndex(0),
  );
  t.equal(verified, true);

  t.end();
});

test('get max transactions per block', async (t) => {
  t.equal(Block.MaxTransactionCount, 20);
  t.end();
});

test('verify size pass for block under or equal max transaction count', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const oversizedBlock = await mock.blockWithTransactions(Block.MaxTransactionCount);
  oversizedBlock.setPreviousHash(previousHeader.getHash());
  await oversizedBlock.mine();

  t.equal(oversizedBlock.verifySize(), true);

  t.equal(await oversizedBlock.verifyTransactions(), true);
  t.equal(await oversizedBlock.verify(
    previousHeader,
    Chain.blockRewardAtIndex(numOfBlocks),
  ), true);

  t.end();
});

test('verify size pass for block under or equal max transaction count', async (t) => {
  const numOfBlocks = 3;

  const chain = await mock.chainWithHeaders(numOfBlocks, 2);
  const previousHeader = chain.lastBlockHeader();

  const oversizedBlock = await mock.blockWithTransactions(Block.MaxTransactionCount + 1);
  oversizedBlock.setPreviousHash(previousHeader.getHash());
  await oversizedBlock.mine();

  t.equal(oversizedBlock.verifySize(), false);

  t.equal(await oversizedBlock.verifyTransactions(), false);
  t.equal(await oversizedBlock.verify(
    previousHeader,
    Chain.blockRewardAtIndex(numOfBlocks),
  ), false);

  t.end();
});
