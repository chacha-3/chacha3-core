const assert = require('assert');
const Block = require('../models/block');
const Chain = require('../models/chain');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Peer = require('../models/peer');
const { randomNumberBetween } = require('./math');

const mock = {};

mock.createWallets = async (count) => {
  const createWallet = (i) => new Promise((resolve) => {
    const wallet = new Wallet();
    wallet.setLabel(`addWallet${i}`);
    wallet.generate();

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

  return peer;
};

mock.blockWithTransactions = async (numOfTransactions) => {
  assert(numOfTransactions > 0);

  const minusCoinbase = numOfTransactions - 1;

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddressEncoded());

  for (let i = 0; i < minusCoinbase; i += 1) {
    const sender = new Wallet();
    sender.generate();

    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddressEncoded(),
      Math.floor(Math.random() * (100 - 1) + 1),
    );

    transaction.sign(sender.getPrivateKeyObject());
    block.addTransaction(transaction);
  }

  await block.mine();

  return block;
};

mock.chainWithBlocks = async (numOfBlocks, transactionsPerBlock) => {
  assert(numOfBlocks > 0);
  assert(transactionsPerBlock > 0);

  const blocks = await Promise.all(
    Array.from({ length: numOfBlocks }, () => mock.blockWithTransactions(transactionsPerBlock)),
  );

  const chain = new Chain();

  for (let i = 0; i < numOfBlocks; i += 1) {
    // await chain.addBlock(blocks[i]);
    await Block.save(blocks[i]);
    chain.addBlockHeader(blocks[i].getHeader());
  }

  await Chain.save(chain);
  return chain;
};

module.exports = mock;
