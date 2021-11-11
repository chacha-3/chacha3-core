const assert = require('assert');

const Block = require('../models/block');
const Chain = require('../models/chain');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Peer = require('../models/peer');
const { randomNumberBetween } = require('./math');
const { deserializeBuffer } = require('./serialize');

const mock = {};

mock.createWallets = async (count, password) => {
  const createWallet = (i) => new Promise((resolve) => {
    const wallet = new Wallet();
    wallet.setLabel(`addWallet${i}`);
    wallet.generate(password);

    Wallet.save(wallet).then(() => resolve(wallet));
  });

  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(createWallet(i));
  }

  return Promise.all(promises);
};

mock.nodePeer = () => {
  const ip = new Array(4).fill(0).map(() => randomNumberBetween(0, 255));
  const peer = new Peer(`${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`, 8888);

  peer.setChainLength(100);
  peer.setVersion('0.0.1');
  peer.setTotalWork(100);

  return peer;
};

// mock.peerList = (numOfPeers) => {
//   const list = [];

//   for (let i = 0; i < numOfPeers; i += 1) {
//     list.push(this.nodePeer());
//   }

//   return list;
// };

mock.createPeers = async (count) => {
  const createPeer = () => new Promise((resolve) => {
    const peer = mock.nodePeer();

    peer.save();
    resolve(peer);
  });

  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(createPeer());
  }

  return Promise.all(promises);
};

mock.blockWithTransactions = async (numOfTransactions, previousBlock, rewardReceiverWallet, reward) => {
  assert(numOfTransactions > 0);

  const minusCoinbase = numOfTransactions - 1;

  let sender = rewardReceiverWallet;

  if (!sender) {
    sender = new Wallet();
    sender.generate();
  }

  const randomWallet = new Wallet();
  randomWallet.generate();

  const block = new Block();
  block.addCoinbase(sender.getAddress(), reward);

  if (previousBlock) {
    block.setPreviousHash(previousBlock.getHeader().getHash());
  } else {
    block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  }

  for (let i = 0; i < minusCoinbase; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      randomWallet.getAddress(),
      Math.floor(Math.random() * (100 - 1) + 1),
    );

    transaction.sign(sender.getPrivateKey());
    assert(transaction.verify() === true);
    // await transaction.save();

    block.addTransaction(transaction);
  }

  await block.mine();

  return block;
};

mock.chainWithHeaders = async (numOfBlocks, transactionsPerBlock) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const minusGenesis = numOfBlocks - 1;

  const chain = new Chain();
  chain.addBlockHeader(Block.Genesis.getHeader());

  let previousBlock = Block.Genesis;

  for (let i = 0; i < minusGenesis; i += 1) {
    const block = await mock.blockWithTransactions(transactionsPerBlock, previousBlock)
    chain.addBlockHeader(block.getHeader());

    previousBlock = block;
  }

  return chain;
};

// Alternative chain with different genesis block
mock.altChainWithHeaders = async (numOfBlocks, transactionsPerBlock) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const minusGenesis = numOfBlocks - 1;

  const wallet = new Wallet();
  wallet.generate();

  const altGenesis = new Block();
  altGenesis.addCoinbase(wallet.getAddress());
  altGenesis.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await altGenesis.mine();

  const chain = new Chain();
  chain.addBlockHeader(altGenesis.getHeader());

  let previousBlock = Block.Genesis;

  for (let i = 0; i < minusGenesis; i += 1) {
    const block = await mock.blockWithTransactions(transactionsPerBlock, previousBlock)
    chain.addBlockHeader(block.getHeader());

    previousBlock = block;
  }

  return chain;
};

mock.chainWithBlocks = async (numOfBlocks, transactionsPerBlock, receiverWallet) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const minusGenesis = numOfBlocks - 1;

  const chain = new Chain();
  await Block.Genesis.save();

  let previousBlock = Block.Genesis;

  for (let i = 0; i < minusGenesis; i += 1) {
    // No extra transactions for first block as sender has no balance to send yet
    const numOfTransactions = (i > 0) ? transactionsPerBlock : 1;

    // eslint-disable-next-line no-await-in-loop
    const block = await mock.blockWithTransactions(
      numOfTransactions,
      previousBlock,
      receiverWallet,
      Chain.blockRewardAtIndex(i + 1),
    );

    // eslint-disable-next-line no-await-in-loop
    const result = await chain.confirmNewBlock(block);
    assert(result);

    previousBlock = block;
  }

  // await Chain.save(chain);
  return chain;
};

mock.altChainWithBlocks = async (numOfBlocks, transactionsPerBlock, receiverWallet) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const minusGenesis = numOfBlocks - 1;

  const chain = new Chain();

  const altGenesis = new Block();

  const wallet = new Wallet();
  wallet.generate();

  altGenesis.addCoinbase(wallet.getAddress());
  altGenesis.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));

  await altGenesis.mine();
  await altGenesis.save();

  let previousBlock = altGenesis;

  for (let i = 0; i < minusGenesis; i += 1) {
    // No extra transactions for first block as sender has no balance to send yet
    const numOfTransactions = (i > 0) ? transactionsPerBlock : 1;

    // eslint-disable-next-line no-await-in-loop
    const block = await mock.blockWithTransactions(
      numOfTransactions,
      previousBlock,
      receiverWallet,
      Chain.blockRewardAtIndex(i + 1),
    );

    // eslint-disable-next-line no-await-in-loop
    const result = await chain.confirmNewBlock(block);
    assert(result);

    previousBlock = block;
  }

  // await Chain.save(chain);
  return chain;
};

mock.transaction = () => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddress(),
    Math.floor(Math.random() * (100 - 1) + 1),
  );

  transaction.sign(sender.getPrivateKey());

  return transaction;
};

mock.pendingTransactions = (numOfTransactions) => {
  assert(numOfTransactions > 0);

  const transactions = [];
  for (let i = 0; i < numOfTransactions; i += 1) {
    transactions.push(mock.transaction());
  }

  return transactions;
};

mock.blockList = async (numberOfBlocks, transactionsPerBlock, minerWallet) => {
  const blocks = [];
  let previousHash = deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000');

  let wallet = minerWallet;

  if (!wallet) {
    wallet = new Wallet();
    wallet.generate();
  }

  for (let i = 0; i < numberOfBlocks; i += 1) {
    const receiver = new Wallet();
    receiver.generate();

    const block = new Block();
    block.addCoinbase(wallet.getAddress());
    block.setPreviousHash(previousHash);

    const minusCoinbase = transactionsPerBlock - 1;
    for (let j = 0; j < minusCoinbase; j += 1) {
      const transaction = new Transaction(
        wallet.getPublicKey(),
        receiver.getAddress(),
        Math.floor(Math.random() * (100 - 1) + 1),
      );

      transaction.sign(wallet.getPrivateKey());
      block.addTransaction(transaction);
    }

    await block.mine();
    previousHash = block.getHeader().getHash();
    blocks.push(block);
  }

  return blocks;
};

module.exports = mock;
