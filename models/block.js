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
        hash: '0x00b6b30267c1502e2d717a2696410bf9c03e448741efc9ccabd1bc84e6fa3dbd',
        previous: null,
        time: 1637902963395,
        difficulty: 1,
        nonce: 8609437805620442,
        checksum: '0x385deec3656ac30a97d5b37837732214c0175950073f08aaffc095470eabd876',
        version: 1,
      },
      transactions: [
        {
          id: '0x142f7bb983445793a031aed7e241a48efa74dbdd70d3d0ed74404485fc96ba05',
          version: 1,
          senderKey: null,
          receiverAddress: '0x00cc460a150ce94fe032e806d586fc84ec515dc12ed934743b',
          amount: '5000000n',
          signature: null,
          time: 1637902963396,
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
    if (this.transactionAdded(transaction.getId())) {
      return false;
    }

    // Only the coinbase transaction can be added without signature
    if (transaction.getSignature() == null && this.getTransactionCount() !== 0) {
      throw new Error('Unable to add unsigned transaction to block');
    }

    if (!transaction.verify()) {
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
          return reject();
        }

        if (!transaction.verify()) {
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

    // // Combine verify checksum and transactions
    if (!this.verifyChecksum()) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed checksum verification`);
      return false;
    }

    if (!(await this.verifyTransactions())) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed transaction verification`);
      return false;
    }

    if (!this.verifyHash()) {
      debug(`Block: ${this.getHeader().getHash().toString('hex')}. Failed hash verification`);
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

  static async clear(hash) {
    const block = await Block.load(hash);

    if (!block) {
      return;
    }

    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      // FIXME: Does not await. But test still passes
      // TODO: Wrap in promise

      if (!block.getTransaction(i).getId()) {
        console.log(block.getTransaction(i));
      }
      await Transaction.clear(block.getTransaction(i).getId());
    }

    // FIXME: Error sometimes
    // Block load return { header: null, transactions: [ null, null, null ] }
    // Promise.all([Header.clear(hash), BlockDB.del(hash)]);

    // But this works fine.
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
