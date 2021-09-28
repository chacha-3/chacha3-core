const crypto = require('crypto');
const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode, ErrorCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const { serializeBuffer } = require('../../util/serialize');
const Transaction = require('../../models/transaction');
const { randomNumberBetween } = require('../../util/math');
const app = require('../../app')();

test('push new block', async (t) => {
  const initialBlockCount = 2;

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 1, sender);

  const transactionInBlock = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10);
  transactionInBlock.sign(sender.getPrivateKeyObject());

  const transactionNotInBlock = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10);
  transactionNotInBlock.sign(sender.getPrivateKeyObject());

  // Save to pending transaction list
  await transactionInBlock.save(true);
  await transactionNotInBlock.save(true);

  const pendingBefore = await Transaction.loadPending();
  t.equal(pendingBefore.length, 2);

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(wallet.getAddress());
  block.addTransaction(transactionInBlock);

  await block.mine();

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(Chain.mainChain.getLength(), initialBlockCount + 1);

  const pendingAfter = await Transaction.loadPending();
  t.equal(pendingAfter.length, 1);

  await Chain.clearMain();

  t.end();
});

test('list blocks in chain', async (t) => {
  const blockCount = 3;

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const options = { action: 'listBlocks' };

  const { code, data } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(data.length, blockCount);

  const fields = ['hash', 'previous', 'time', 'difficulty', 'nonce', 'checksum', 'version'];

  fields.forEach((field) => {
    t.ok(Object.prototype.hasOwnProperty.call(data[0], field));
  });

  await Chain.clearMain();

  t.end();
});

test('unable to push invalid block', async (t) => {
  const blockCount = 3;

  const wallet = new Wallet();
  wallet.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1);

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(wallet.getAddress());

  // Tamper checksum
  block.header.checksum[3] += 100;

  await block.mine();

  const options = { action: 'pushBlock', ...block.toObject() };

  const { code, data } = await runAction(options);
  t.equal(code, ErrorCode.InvalidArgument);

  await Chain.clearMain();

  t.end();
});

test('unable to push block with transaction exceeding balance', async (t) => {
  const blockCount = 3;

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(blockCount, 1, sender);

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(sender.getAddress());

  const exceedAmount = Block.InitialReward * BigInt(blockCount + 4);
  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), exceedAmount);
  transaction.sign(sender.getPrivateKeyObject());

  block.addTransaction(transaction);
  await block.mine();

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

  const fields = ['id', 'sender', 'receiver', 'amount', 'version', 'time', 'signature'];

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
