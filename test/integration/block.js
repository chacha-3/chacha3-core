const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const { serializeBuffer } = require('../../util/serialize');
const Transaction = require('../../models/transaction');
const app = require('../../app')();

test('push new block', async (t) => {
  const initialBlockCount = 2;

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 1, sender);

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddress(), 10);
  transaction.sign(sender.getPrivateKeyObject());

  // Save to pending transaction list
  await transaction.save(true);

  const pendingBefore = await Transaction.loadPending();
  t.equal(pendingBefore.length, 1);

  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.setPreviousHash(Chain.mainChain.lastBlockHeader().getHash());
  block.addCoinbase(wallet.getAddress());
  block.addTransaction(transaction);

  await block.mine();

  const options = { action: 'pushBlock', ...block.toObject() };

  const { data, code } = await runAction(options);
  t.equal(code, SuccessCode);
  t.equal(Chain.mainChain.getLength(), initialBlockCount + 1);

  const pendingAfter = await Transaction.loadPending();
  t.equal(pendingAfter.length, 0);

  t.end();
});

// test('cannot push invalid block', async (t) => {
//   const initialBlockCount = 5;
//   Chain.mainChain = await mock.chainWithBlocks(initialBlockCount, 3);
//   const chain = Chain.mainChain;

//   const wallet = new Wallet();
//   wallet.generate();

//   const block = new Block();

//   block.addCoinbase(wallet.getAddress());
//   block.setPreviousHash(chain.lastBlockHeader().getHash());

//   await block.mine();

//   // Tamper hash. Invalid
//   block.header.checksum[0] = 255;
//   block.header.hash[3] = 5;
//   block.header.hash[10] = 5;
//   block.header.hash[12] = 5;

//   const options = { action: 'pushBlock', ...block.toObject() };

//   const { data, code } = await runAction(options);
//   // t.equal(code, SuccessCode);
//   console.log(code, data);

//   t.equal(Chain.mainChain.getLength(), initialBlockCount);
//   t.end();
// });
