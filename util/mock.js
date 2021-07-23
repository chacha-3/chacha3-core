const assert = require('assert');
const Block = require('../models/block');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const mock = {};

mock.createWallets = async (count) => {
  const createWallet = (i) => new Promise((resolve) => {
    const wallet = new Wallet();
    wallet.setLabel(`addWallet${i}`);
    wallet.generate();

    wallet.save().then(() => resolve(wallet));
  });

  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(createWallet(i));
  }

  return Promise.all(promises);
};

mock.blockWithTransactions = (numOfTransactions) => {
  assert(numOfTransactions > 0);

  const minusCoinbase = numOfTransactions - 1;

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddressEncoded());

  for (let i = 0; i < minusCoinbase; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddressEncoded(),
      Math.floor(Math.random() * (100 - 1) + 1),
    );

    transaction.sign(sender.getPrivateKeyObject());
    block.addTransaction(transaction);
  }

  block.mine();

  return block;
};

module.exports = mock;
