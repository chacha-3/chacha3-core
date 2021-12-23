const assert = require('assert');
const crypto = require('crypto');
const debug = require('debug')('block:model');

const { performance } = require('perf_hooks');

const Header = require('./header');
const Transaction = require('./transaction');

const { BlockDB, TransactionDB } = require('../util/db');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');
const Wallet = require('./wallet');

class Block {
  constructor() {
    this.header = new Header();
    this.transactions = [];
  }

  static get InitialReward() {
    return 5000000n;
  }

  static get Genesis() {
    const data = {
      header: {
        hash: '0x3e665e3c690c2dd849b6b9e2acb3cccbbb389fad82e4c2651ffd31fa867417c2',
        previous: null,
        time: 1640253775347,
        difficulty: 1,
        nonce: 5759856986198599,
        checksum: '0x55e4adb5455ba11dcae9489590480d80150450b6691f1d12302750029549470b',
        version: 1,
      },
      transactions: [
        {
          id: '0x7a0d253b8b97b8aaa7988cff3c5f3eb415c3e930313a5e3d51e297f85e3665a4',
          version: 1,
          senderKey: null,
          receiverAddress: '0x00defade294c7e35b3d0f374872e5ded459affb16aff9b9e7d',
          amount: '5000000n',
          signature: null,
          time: 1640253775348,
          type: 'mine',
        },
      ],
    };

    return Block.fromObject(data);
  }

  setPreviousHash(hash) {
    this.header.setPrevious(hash);
  }

  addCoinbase(receiverAddress, currentReward = Block.InitialReward) {
    const transaction = new Transaction(
      null,
      receiverAddress,
      currentReward,
      Transaction.Type.Mine,
    );

    this.addTransaction(transaction);
  }

  transactionAdded(transactionId) {
    const found = this.transactions.find((t) => t.getId().equals(transactionId));
    return found !== undefined;
  }

  addTransaction(transaction) {
    // Only the coinbase transaction can be added without signature
    if (transaction.getSignature() == null && this.getTransactionCount() !== 0) {
      throw new Error('Unable to add unsigned transaction to block');
    }

    if (!transaction.verify()) {
      return false;
    }

    if (this.transactionAdded(transaction.getId())) {
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

  getCoinbaseTransaction() {
    assert(this.transactions.length > 0);

    return this.getTransaction(0);
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

  async mine(difficulty = 1) {
    const start = performance.now();
    let found = false;

    this.header.setDifficulty(difficulty);

    while (!found) {
      this.header.incrementNonce();

      // eslint-disable-next-line no-await-in-loop
      this.header.computeHash();

      found = this.verifyHash();
    }

    const end = performance.now();

    return end - start;
  }

  // FIXME: Move this to header
  verifyHash() {
    assert(this.getTransactionCount() > 0);

    const hashNum = BigInt(serializeBuffer(this.header.getHash()));
    return hashNum < this.header.getTarget();
  }

  async verifyTransactions() {
    const verify = (transaction) => new Promise((resolve, reject) => {
      transaction.isSaved().then((saved) => {
        if (saved) {
          debug(`Transaction ${serializeBuffer(transaction.getId())} is already saved`);
          return reject();
        }

        if (!transaction.verify()) {
          debug(`Transaction ${serializeBuffer(transaction.getId())} is not verified`);
          return reject();
        }

        return resolve();
      });
    });

    const promises = [];

    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      const transaction = this.getTransaction(i);
      promises.push(verify(transaction));
    }

    try {
      await Promise.all(promises);
    } catch (e) {
      return false;
    }

    return true;
  }

  validateCoinbase() {
    const coinbase = this.getTransaction(0);

    if (coinbase.getSenderKey() !== null || coinbase.getSignature() !== null) {
      return false;
    }

    if (coinbase.getType() !== Transaction.Type.Mine) {
      return false;
    }

    if (!Wallet.verifyAddress(coinbase.getReceiverAddress())) {
      debug('Invalid coinbase wallet address');
      return false;
    }

    return true;
  }

  verifyCoinbase(reward = Block.InitialReward) {
    if (!this.validateCoinbase()) {
      return false;
    }

    if (this.getCoinbaseTransaction().getAmount() !== reward) {
      return false;
    }

    return true;
  }

  verifyPrevious(previousHeader) {
    assert(previousHeader !== null);

    const previousHash = this.getHeader().getPrevious();
    if (!previousHash.equals(previousHeader.getHash())) {
      debug('Failed to confirm new block: Does not match latest hash');
      return false;
    }

    return true;
  }

  verifyTimestamp(previousHeader) {
    const lastBlockTime = previousHeader.getTime();
    const currentBlockTime = this.getHeader().getTime();

    const threshold = 5000; // TODO: Test
    return currentBlockTime >= lastBlockTime && currentBlockTime <= Date.now() + threshold;
  }

  async verify(previousHeader = null, currentReward = null) {
    assert(currentReward !== null);

    if (!this.verifyCoinbase(currentReward)) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed coinbase verification`);
      return false;
    }

    if (!this.verifyHash()) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed hash verification`);
      return false;
    }

    // // Combine verify checksum and transactions
    if (!this.verifyChecksum()) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed checksum verification`);
      return false;
    }

    if (!(await this.verifyTransactions())) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed transaction verification (exist)`);
      return false;
    }

    // To skip the rest for genesis block
    if (previousHeader === null) {
      return true;
    }

    if (!this.verifyPrevious(previousHeader)) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed previous block verification`);
      return false;
    }

    // TODO: Verify timestamp for genesis required?
    if (!this.verifyTimestamp(previousHeader)) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed timestamp verification`);
      return false;
    }

    return true;
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

  // TODO: Remove. Unused
  async hasNoExistingTransactions() {
    const checkNotSaved = (transaction) => new Promise((resolve, reject) => {
      transaction.isSaved().then((saved) => (saved ? reject() : resolve()));
    });

    const promises = [];

    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      const transaction = this.getTransaction(i);
      promises.push(checkNotSaved(transaction));
    }

    try {
      await Promise.all(promises);
    } catch (e) {
      return false;
    }

    return true;
  }

  verifyChecksum() {
    assert(this.getHeader().getChecksum() !== null);

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

  async saveTransactions() {
    const saveTransaction = (transaction) => new Promise((resolve) => {
      transaction.save();

      // Clear from pending transaction
      // Except coinbase that would not be in pending
      if (!transaction.isCoinbase()) {
        Transaction.clear(transaction.getId(), true);
      }

      resolve(transaction.getId());
    });

    const promises = [];

    this.getTransactions().forEach((value) => promises.push(saveTransaction(value)));
    return Promise.all(promises);
  }

  static async loadTransactions(indexes) {
    const loadTransaction = (hash) => new Promise((resolve) => {
      const transaction = Transaction.load(hash);
      assert(transaction !== null);

      resolve(transaction);
    });

    const promises = [];

    indexes.forEach((index) => promises.push(loadTransaction(index)));
    return Promise.all(promises);
  }

  async save() {
    // Disabled as require current block reward to verify correctly
    // assert(this.verify());

    const key = this.getHeader().getHash();

    const header = this.getHeader();
    await header.save();

    const transactionIds = await this.saveTransactions();
    const data = {
      transactionIndexes: transactionIds.map((id) => serializeBuffer(id)),
    };

    await BlockDB.put(key, data, { valueEncoding: 'json' });
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

    if (transactions.length > 0) {
      assert(transactions[0] !== null);
    }

    block.setTransactions(transactions);

    return block;
  }

  // On accept new block, remove transactions in block from pending transactions
  async clearPendingTransactions() {
    const clearTransaction = (id) => new Promise((resolve) => {
      resolve(Transaction.clear(id, true));
    });

    const promises = [];

    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      promises.push(clearTransaction(this.getTransaction(i).getId()));
    }

    await Promise.all(promises);
  }

  async clearTransactions() {
    const promises = [];

    for (let i = 0; i < this.getTransactionCount(); i += 1) {
      promises.push(Transaction.clear(this.getTransaction(i).getId()));
    }

    return Promise.all(promises);
  }

  static async clear(hash) {
    const block = await Block.load(hash);

    if (!block) {
      return;
    }

    await block.clearTransactions();

    await Header.clear(hash);
    await BlockDB.del(hash);
  }

  static async clearAll() {
    // TODO: Clear only transactions in block
    TransactionDB.clear();
    BlockDB.clear();
  }
}

module.exports = Block;
