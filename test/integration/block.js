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

  await Transaction.clearAll();
  await Block.clearAll();

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

  await Block.clearAll();

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

  await Block.clearAll();

  t.end();
});

test('block info', async (t) => {
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

  await Block.clearAll();

  t.end();
});
