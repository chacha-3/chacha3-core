const crypto = require('crypto');
const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { SuccessCode, ErrorCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const { serializeBuffer, deserializeBuffer } = require('../../util/serialize');
const Transaction = require('../../models/transaction');
const { randomNumberBetween } = require('../../util/math');

test('push new block', async (t) => {
  const initialBlockCount = 2;

  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 1, sender);

  const transactionInBlock = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10);
  await transactionInBlock.sign(sender.getPrivateKey());

  const transactionNotInBlock = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10);
  await transactionNotInBlock.sign(sender.getPrivateKey());

  // Save to pending transaction list
  await transactionInBlock.saveAsPending();
  await transactionNotInBlock.saveAsPending();

  const pendingBefore = await Transaction.loadPending();
  t.equal(pendingBefore.length, 2);

  const wallet = new Wallet();
  await wallet.generate();

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(wallet.getAddress());
  block.addTransaction(transactionInBlock);

  await block.mine(Chain.mainChain.getCurrentDifficulty());

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(Chain.mainChain.getLength(), initialBlockCount + 1);

  const pendingAfter = await Transaction.loadPending();
  t.equal(pendingAfter.length, 1);

  await Chain.clearMain();
  await Transaction.clearAll(); // TODO: Clear only pending transaction

  t.end();
});

test('list blocks in chain', async (t) => {
  const blockCount = 3;

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const options = { action: 'listBlocks' };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(data.length, blockCount);

  const fields = ['hash', 'previous', 'time', 'difficulty', 'checksum', 'version', 'a', 'x', 'y', 'z'];

  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(data[0], field));
  });

  await Chain.clearMain();

  t.end();
});

test('list blocks in chain in descending order', async (t) => {
  const blockCount = 3;

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const options = { action: 'listBlocks', order: 'desc' };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(data.length, blockCount);

  t.equal(data[blockCount - 1].hash, serializeBuffer(Block.Genesis.getHeader().getHash()));

  await Chain.clearMain();

  t.end();
});

test('list blocks with filter', async (t) => {
  const blockCount = 5;

  const offset = 1;
  const limit = 2;
  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const options = { action: 'listBlocks', offset, limit };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(data.length, 2);

  await Chain.clearMain();

  t.end();
});

test('unable to push invalid block', async (t) => {
  const blockCount = 3;

  const wallet = new Wallet();
  await wallet.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(wallet.getAddress());

  // Tamper checksum
  block.header.checksum[3] += 100;

  await block.mine(Chain.mainChain.getCurrentDifficulty());

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code } = await runAction(options);
  t.equal(code, ErrorCode.InvalidArgument);

  await Chain.clearMain();

  t.end();
});

test('unable to push unverified block', async (t) => {
  const blockCount = 3;

  const wallet = new Wallet();
  await wallet.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  block.header.setHash(deserializeBuffer(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  ));

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code } = await runAction(options);
  t.equal(code, ErrorCode.InvalidArgument);

  await Chain.clearMain();

  t.end();
});

test('unable to push block with transaction exceeding balance', async (t) => {
  const blockCount = 3;

  const sender = new Wallet();
  await sender.generate();

  const receiver = new Wallet();
  await receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, sender);

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(sender.getAddress());

  const exceedAmount = Block.InitialReward * BigInt(blockCount + 4);
  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), exceedAmount);
  await transaction.sign(sender.getPrivateKey());

  block.addTransaction(transaction);
  await block.mine(Chain.mainChain.getCurrentDifficulty());

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code } = await runAction(options);
  t.equal(code, ErrorCode.InvalidArgument);

  await Chain.clearMain();

  t.end();
});

test('block info for existing block', async (t) => {
  const blockCount = 3;

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const randomBlock = Chain.mainChain.getBlockHeader(randomNumberBetween(0, blockCount - 1));

  const options = { action: 'blockInfo', hash: serializeBuffer(randomBlock.getHash()) };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);

  const fields = ['header', 'transactions'];

  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(data, field));
  });

  await Chain.clearMain();

  t.end();
});

test('block info for non-existing block', async (t) => {
  const options = { action: 'blockInfo', hash: serializeBuffer(crypto.randomBytes(32)) };

  const { code } = await runAction(options);
  t.equal(code, ErrorCode.NotFound);
  t.end();
});

test('block transactions list for existing block', async (t) => {
  const blockCount = 3;

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const randomBlock = Chain.mainChain.getBlockHeader(randomNumberBetween(0, blockCount - 1));

  const options = { action: 'blockTransactions', hash: serializeBuffer(randomBlock.getHash()) };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);

  const fields = ['id', 'senderKey', 'receiverAddress', 'amount', 'version', 'time', 'signature'];

  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(data[0], field));
  });

  // await Block.clearAll();
  await Chain.clearMain();

  t.end();
});

test('block info for non-existing block', async (t) => {
  const options = { action: 'blockTransactions', hash: serializeBuffer(crypto.randomBytes(32)) };

  const { code } = await runAction(options);
  t.equal(code, ErrorCode.NotFound);
  t.end();
});
