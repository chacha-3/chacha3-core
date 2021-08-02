const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const { performance } = require('perf_hooks');

const Header = require('./header');
const Transaction = require('./transaction');

const { WalletDB, BlockDB } = require('../util/db');

class Block {
  constructor() {
    this.header = new Header();
    // this.transactionCount = 0;
    this.transactions = [];

    // this.lastChecksum = Buffer.from([]);

    // this.coinbase = new Transaction();
  }

  addCoinbase(receiverAddress) {
    const transaction = new Transaction(null, receiverAddress, 100);
    this.addTransaction(transaction);
  }

  addTransaction(transaction) {
    // Only the coinbase transaction can be added without signature
    if (transaction.getSignature() == null) {
      assert.strictEqual(this.getTransactionCount(), 0);
    }

    this.transactions.push(transaction);
    // this.transactionCount += 1;

    this.updateChecksum(transaction.getId());
  }

  getTransactions() {
    return this.transactions;
  }

  getTransaction(index) {
    return this.transactions[index];
  }

  getTransactionCount() {
    return this.transactions.length;
  }

  setTransactions(transactions) {
    this.transactions = transactions;
  }

  getHeader() {
    return this.header;
  }

  setHeader(header) {
    this.header = header;
  }

  mine() {
    const start = performance.now();

    while (!this.verifyHash()) {
      this.header.incrementNonce();
    }

    const end = performance.now();

    return end - start;
  }

  verifyHash() {
    assert(this.getTransactionCount() > 0);

    const hashNum = new BN(this.header.getHash(), 16);
    const targetNum = new BN(this.header.getTarget(), 16);

    return hashNum.lt(targetNum);
  }

  verify() {
    return this.verifyHash() && this.verifyChecksum();
  }

  updateChecksum(newTransactionId) {
    assert(newTransactionId != null);

    const lastChecksum = this.header.getChecksum() || Buffer.from([]);

    const fingerprint = Buffer.concat([lastChecksum, newTransactionId]);
    const newChecksum = crypto.createHash('SHA256').update(fingerprint).digest();

    this.header.setChecksum(newChecksum);
  }

  verifyChecksum() {
    let lastChecksum = Buffer.from([]);

    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      const transaction = this.transactions[i];
      const fingerprint = Buffer.concat([lastChecksum, transaction.getId()]);

      lastChecksum = crypto.createHash('SHA256').update(fingerprint).digest();
    }

    return this.getHeader().getChecksum().equals(lastChecksum);
  }

  // verifySize() {
  //   // TODO:
  // }

  // verifyTimestamp() {
  //   // TODO: For new blocks, ensure less than two hours into future for time errors
  // }

  // verifyOnlyFirstIsCoinBase() {

  // }

  // toObject() {
  //   const data = {
  //     header: this.getHeader().toObject(),
  //     transactionCount: this.transactionCount,
  //     transactions: [],
  //   };

  //   for (let i = 0; i < this.transactionCount; i += 1) {
  //     const transaction = this.transactions[i];
  //     data.transactions.push(transaction.toObject());
  //   }

  //   return data;
  // }

  // fromObject() {

  // }

  static async saveTransactions(block) {
    const saveTransaction = (transaction) => new Promise((resolve) => {
      const result = Transaction.save(transaction);
      resolve(result);
    });

    const promises = [];

    block.getTransactions().forEach((value) => promises.push(saveTransaction(value)));
    return Promise.all(promises);
  }

  static async loadTransactions(indexes) {
    const loadTransaction = (hash) => new Promise((resolve) => {
      const transaction = Transaction.load(hash);
      resolve(transaction);
    });

    const promises = [];

    indexes.forEach((index) => promises.push(loadTransaction(index)));
    return Promise.all(promises);
  }

  static async save(block) {
    // assert(transaction.getId() != null);
    const key = block.getHeader().getHash();

    const header = block.getHeader();
    await Header.save(header);

    const transactions = await Block.saveTransactions(block);
    const data = {
      transactionIndexes: transactions.map((transaction) => transaction.key.toString('hex')),
    };

    await BlockDB.put(key, data, { valueEncoding: 'json' });

    return { key, data };
  }

  static async load(hash) {
    let data;

    try {
      data = await BlockDB.get(hash, { valueEncoding: 'json' });
    } catch (e) {
      return false;
    }

    const block = new Block();

    const header = await Header.load(hash);
    block.setHeader(header);

    const indexes = data.transactionIndexes.map((hexKey) => Buffer.from(hexKey, 'hex'));
    const transactions = await Block.loadTransactions(indexes);

    block.setTransactions(transactions);

    return block;
  }

  static async clearAll() {
    BlockDB.clear();
  }
}

module.exports = Block;
