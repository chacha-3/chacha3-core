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
    // 1 quintillion
    return 1000000000000000000n;
  }

  static get Genesis() {
    const data = {
      header: {
        hash: '0x000004bcdf196045c68810b14189c5adb092dcb61186d5054f6aa110e524d009',
        previous: null,
        time: 1640786128357,
        difficulty: 1,
        nonce: 5313587008844815,
        checksum: '0x892851747fca845581ad08b5ced673916fb4f32fc12425e95c750b8d54dd7cbe',
        version: 1,
      },
      transactions: [
        {
          id: '0x6df4aba09defe90421f0e8064ab22b57c45e2b44187f1b35584a213c8d4696b2',
          version: 1,
          senderKey: null,
          receiverAddress: '0x00b406f8c3746762361103d8b0f992bcc6480ce5d33956ec18',
          amount: '1000000000000000000n',
          signature: null,
          time: 1640786128358,
          type: 'mine',
          fee: '0n',
        },
      ],
    };

    return Block.fromObject(data);
  }

  setPreviousHash(hash) {
    this.header.setPrevious(hash);
  }

  addCoinbase(rewardAddress, currentReward = Block.InitialReward) {
    const transaction = new Transaction(
      null,
      rewardAddress,
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

    if (this.getTransactionCount() > 0 && transaction.getType() !== Transaction.Type.Send) {
      return false;
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
      this.header.hash = this.header.computeHash();

      found = this.verifyHash();
    }

    const end = performance.now();

    return end - start;
  }

  // TODO: Moved this to header. Remove this
  verifyHash(recalculate = true) {
    assert(this.getTransactionCount() > 0);

    return this.header.verifyHash(recalculate);
  }

  async verifyTransactions() {
    const verify = (transaction, index) => new Promise((resolve, reject) => {
      transaction.isSaved().then((saved) => {
        if (saved) {
          debug(`Transaction ${serializeBuffer(transaction.getId())} is already saved`);
          return reject();
        }

        // Ensure non-coinbase does not have type Mine
        if (index !== 0 && transaction.getType() === Transaction.Type.Mine) {
          debug(`Transaction ${serializeBuffer(transaction.getId())} has multiple mining transactions`);
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
      promises.push(verify(transaction, i));
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

    if (coinbase.getFee() !== 0n) {
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

    await BlockDB.put(key, data, { keyEncoding: 'binary', valueEncoding: 'json' });
  }

  static async load(hash) {
    let data;

    try {
      data = await BlockDB.get(hash, { keyEncoding: 'binary', valueEncoding: 'json' });
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
