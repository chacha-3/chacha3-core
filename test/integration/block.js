const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const { serializeBuffer } = require('../../util/serialize');
const app = require('../../app')();

test('get block info', async (t) => {
  const block = await mock.blockWithTransactions(5);
  await block.save();

  const { data } = await runAction({
    action: 'blockInfo',
    hash: serializeBuffer(block.getHeader().getHash()),
  });

  const loaded = Block.fromObject(data);
  t.equal(loaded.verify(), true, 'Loaded block is verified');
  t.equal(loaded.getTransactionCount(), block.getTransactionCount());

  t.ok(loaded.getTransaction(0).getId().equals(block.getTransaction(0).getId()));

  t.end();
});

test('push new block', async (t) => {
  const initialBlockCount = 5;
  Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 3);
  const chain = Chain.mainChain;

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(chain.lastBlockHeader().getHash());

  await block.mine();

  const options = { action: 'pushBlock', ...block.toObject() };

  const { data, code } = await runAction(options);
  t.equal(code, SuccessCode);

  t.equal(Chain.mainChain.getLength(), initialBlockCount + 1);
  t.end();
});

test('cannot push invalid block', async (t) => {
  const initialBlockCount = 5;
  Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 3);
  const chain = Chain.mainChain;

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddress());
  block.setPreviousHash(chain.lastBlockHeader().getHash());

  await block.mine();

  // Tamper hash. Invalid
  block.header.hash[3] = 5;
  block.header.hash[10] = 5;
  block.header.hash[12] = 5;

  const options = { action: 'pushBlock', ...block.toObject() };

  const { data, code } = await runAction(options);
  t.equal(code, SuccessCode);

  t.equal(Chain.mainChain.getLength(), initialBlockCount + 1);
  t.end();
});
