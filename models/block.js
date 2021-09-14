const assert = require('assert');
const crypto = require('crypto');

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
        hash: '00003bf2e3ee6ea764d6a5c270423e9b1fa1e22437c5c2db8bcfc08de3b9d810',
        previous: '0000000000000000000000000000000000000000000000000000000000000000',
        time: 1631588874413,
        difficulty: 1,
        nonce: 2579589239282141,
        checksum: '081990a04546f11fee0ea7b94ced128c75b0bfc84ce894cf274c04dd84e85dae',
        version: 1,
      },
      transactions: [
        {
          id: 'eb8f85f8c0dadbf3ef76aa3d19cd2429b7eefcab4a36bd168b936706f85d130a',
          sender: null,
          receiver: '12xzwcmGkgJc8XdkqYt4E6dhE6LVuARH1b',
          amount: 10000,
          version: 1,
          time: 1631588874414,
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

    const hashNum = BigInt(`0x${this.header.getHash().toString('hex')}`);
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

    // Clear incoming transactions from pending transactions
    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      Transaction.clear(block.getTransaction(i).getId(), true);
    }

    await Block.save(block);
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
