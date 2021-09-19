const assert = require('assert');
const crypto = require('crypto');

const { performance } = require('perf_hooks');

const Header = require('./header');
const Transaction = require('./transaction');

const { BlockDB } = require('../util/db');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');

class Block {
  constructor() {
    this.header = new Header();
    this.transactions = [];
  }

  static get Genesis() {
    const data = {
      header: {
        hash: '0x002a39c6d4943639f4a0d6909b19e0e1342a32f8d88ce06c16a3c8138a206428',
        previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
        time: 1632012517606,
        difficulty: 1,
        nonce: 6612786905278660,
        checksum: '0xee6d2208545074cb8aacbe3b57f2178143dfcfd5312391b61f3b9ee47dc6064b',
        version: 1,
      },
      transactions: [
        {
          id: '0xd19d252e5cf2f94aec66c04c11b614b84a71baad4cc388062bb013b379aca3ac',
          sender: null,
          receiver: '0x000b504a3c870d27a509f6592a9e261097f175481a9b98f350',
          amount: 10000,
          version: 1,
          time: 1632012517606,
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

    // if (!transaction.verify()) {
    //   return false;
    // }

    const index = this.transactions.findIndex((t) => t.getId().equals(transaction.getId()));

    if (index >= 0) {
      return false;
    }

    this.transactions.push(transaction);
    this.updateChecksum(transaction.getId());

    return true;
  }

  addPendingTransactions(pendingList) {
    const rejected = [];

    for (let i = 0; i < pendingList.length; i += 1) {
      const success = this.addTransaction(pendingList[i]);

      if (!success) {
        rejected.push(pendingList[i]);
      }
    }

    return rejected;
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
      this.header.computeHash();

      found = this.verifyHash();
    }

    const end = performance.now();

    return end - start;
  }

  verifyHash() {
    assert(this.getTransactionCount() > 0);

    const hashNum = BigInt(serializeBuffer(this.header.getHash()));
    return hashNum < this.header.getTarget();
  }

  verifyBalances() {
    return true;
  }

  async verifyTransactions() {
    // Check transactions valid
    // Also check no dulicate IDS
    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      // const transaction = await Transaction.load(this.getTransaction(i).getId());

      const transaction = this.getTransaction(i);
      const isSaved = await transaction.isSaved();

      if (isSaved) {
        // TODO: Run this only when mining own block
        await Transaction.clear(transaction.getId(), true);
        return false;
      }

      if (!transaction.verify()) {
        return false;
      }
    }
    return true;
  }

  verify() {
    // const verifiedTransaction = await this.verifyTransactions();
    return this.verifyHash() && this.verifyChecksum() && this.verifyBalances();
  }

  updateChecksum(newTransactionId) {
    assert(newTransactionId != null);

    const lastChecksum = this.header.getChecksum() || Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'hex',
    );

    const fingerprint = Buffer.concat([lastChecksum, newTransactionId]);
    const newChecksum = crypto.createHash('SHA256').update(fingerprint).digest();

    this.header.setChecksum(newChecksum);
  }

  verifyChecksum() {
    let lastChecksum = Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'hex',
    );

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
      const result = transaction.save();
      resolve(transaction.getId());
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

  async save() {
    assert(this.verify());

    const key = this.getHeader().getHash();

    const header = this.getHeader();
    await header.save();

    const transactionIds = await Block.saveTransactions(this);
    const data = {
      transactionIndexes: transactionIds.map((id) => serializeBuffer(id)),
    };

    await BlockDB.put(key, data, { valueEncoding: 'json' });
  }

  static async verifyAndSave(block) {
    if (!block.verify()) {
      return false;
    }

    // Clear incoming transactions from pending transactions
    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      Transaction.clear(block.getTransaction(i).getId(), true);
    }

    await block.save();
    return true;
  }

  static async load(hash) {
    let data;

    try {
      data = await BlockDB.get(hash, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const block = new Block();

    const header = await Header.load(hash);
    block.setHeader(header);

    const indexes = data.transactionIndexes.map((hexKey) => deserializeBuffer(hexKey));
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
