const assert = require('assert');
const clone = require('rfdc')();

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

    Wallet.save(wallet);
    resolve(wallet);
    // wallet.save().then(() => resolve(wallet));
  });

  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(createWallet(i));
  }

  return Promise.all(promises);
};

mock.nodePeer = () => {
  const peer = new Peer();
  const ip = new Array(4).fill(0).map(() => randomNumberBetween(0, 255));

  peer.setAddress(`${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`);
  peer.setPort(8888);
  peer.setChainLength(100);
  peer.setVersion('0.0.1');
  peer.setTotalWork(100);

  return peer;
};

mock.peerList = (numOfPeers) => {
  const list = [];

  for (let i = 0; i < numOfPeers; i += 1) {
    list.push(this.nodePeer());
  }

  return list;
};

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

mock.blockWithTransactions = async (numOfTransactions, previousBlock, receiverWallet) => {
  assert(numOfTransactions > 0);

  const minusCoinbase = numOfTransactions - 1;

  let receiver = receiverWallet;

  if (!receiver) {
    receiver = new Wallet();
    receiver.generate();
  }

  const block = new Block();
  block.addCoinbase(receiver.getAddress());

  if (previousBlock) {
    block.setPreviousHash(previousBlock.getHeader().getHash());
  } else {
    block.setPreviousHash(deserializeBuffer('0x0000000000000000000000000000000000000000000000000000000000000000'));
  }

  for (let i = 0; i < minusCoinbase; i += 1) {
    const sender = new Wallet();
    sender.generate();

    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddress(),
      Math.floor(Math.random() * (100 - 1) + 1),
    );

    transaction.sign(sender.getPrivateKeyObject());
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

mock.chainWithBlocks = async (numOfBlocks, transactionsPerBlock, receiverWallet) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const minusGenesis = numOfBlocks - 1;

  // const additionalBlocks = await Promise.all(
  //   Array.from({ length: minusGenesis }, () => mock.blockWithTransactions(transactionsPerBlock)),
  // );

  const chain = new Chain();
  await Block.Genesis.save();

  chain.addBlockHeader(Block.Genesis.getHeader());

  let previousBlock = Block.Genesis;

  for (let i = 0; i < minusGenesis; i += 1) {
    const block = await mock.blockWithTransactions(transactionsPerBlock, previousBlock, receiverWallet);
    // await block.save();

    // chain.addBlockHeader(block.getHeader());
    await chain.confirmNewBlock(block);

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

  transaction.sign(sender.getPrivateKeyObject());

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

      transaction.sign(wallet.getPrivateKeyObject());
      block.addTransaction(transaction);
    }

    await block.mine();
    previousHash = block.getHeader().getHash();
    blocks.push(block);
  }

  return blocks;
};

mock.clone = (instance) => clone(Object.create(Object.getPrototypeOf(instance)), instance);

module.exports = mock;
