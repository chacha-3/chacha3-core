const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const { performance } = require('perf_hooks');

const Header = require('./header');
const Transaction = require('./transaction');

const { BlockDB } = require('../util/db');

class Block {
  constructor() {
    this.header = new Header();
    this.transactions = [];
  }

  static get Genesis() {
    const data = {
      header: {
        hash: '0075f9696f7680592d84b65051d155367b109049fa5ece4176f7dd2efa2414b7',
        previous: '0000000000000000000000000000000000000000000000000000000000000000',
        time: 1630724227525,
        difficulty: 1,
        nonce: 3648059698804014,
        checksum: '7ff68d966bb84cf700a471f35a8315f4723c1b3cf19c5e0c7aa319c14582311d',
        version: 1,
      },
      transactions: [
        {
          id: 'd9bec02b8d0560f1f68e5da5f892fa66b30b3ef6c9d955b79fc317e51e9f2daf',
          sender: null,
          receiver: '14ztbkqKZEYgGupdQJ9zKaJV3py6YSbzc3',
          amount: 10000,
          version: 1,
          time: 1630724227526,
          signature: null,
        },
      ],
    };

    return Block.fromObject(data);
  }

  setPreviousHash(hash) {
    this.header.setPrevious(hash);
  }

  addCoinbase(receiverAddress) {
    const transaction = new Transaction(null, receiverAddress, 10000);
    this.addTransaction(transaction);
  }

  addTransaction(transaction) {
    // Only the coinbase transaction can be added without signature
    if (transaction.getSignature() == null) {
      assert.strictEqual(this.getTransactionCount(), 0);
    }

    this.transactions.push(transaction);
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

  async mine(difficulty) {
    const start = performance.now();
    let found = false;

    this.header.setDifficulty(difficulty || 1);

    while (!found) {
      this.header.incrementNonce();

      // eslint-disable-next-line no-await-in-loop
      await this.header.computeHash();

      found = this.verifyHash();
    }

    const end = performance.now();

    return end - start;
  }

  verifyHash() {
    assert(this.getTransactionCount() > 0);

    const hex = 16;
    const hashNum = new BN(this.header.getHash(), hex);
    const targetNum = new BN(this.header.getTarget(), hex);

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

  toObject() {
    const data = {
      header: this.getHeader().toObject(),
      transactions: [],
    };

    for (let i = 0; i < this.transactions.length; i += 1) {
      const transaction = this.transactions[i];
      data.transactions.push(transaction.toObject());
    }

    return data;
  }

  static fromObject(obj) {
    const block = new Block();

    const header = Header.fromObject(obj.header);
    block.setHeader(header);

    const { transactions } = obj;

    for (let i = 0; i < transactions.length; i += 1) {
      block.transactions[i] = Transaction.fromObject(transactions[i]);
    }

    return block;
  }

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
    assert(block.verify());

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

  static async verifyAndSave(block) {
    if (!block.verify()) {
      return false;
    }

    await Block.save(block);
    return true;
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
    block.header.setHash(hash);

    return block;
  }

  static async clear(hash) {
    BlockDB.del(hash);
  }

  static async clearAll() {
    BlockDB.clear();
  }
}

module.exports = Block;
