const debug = require('debug')('chain:model');
const assert = require('assert');

const Header = require('./header');

const { DB, BlockDB, HeaderDB, runningManualTest, PendingTransactionDB } = require('../util/db');
const { serializeBuffer, deserializeBuffer, serializeObject } = require('../util/serialize');

const { median, clamp } = require('../util/math');

const Block = require('./block');
const { generateAddressEncoded } = require('./wallet');
const Transaction = require('./transaction');

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

class Chain {
  constructor() {
    this.blockHeaders = [];
    this.accounts = {};
  }

  static getAdjustInterval() {
    const adjustInterval = {
      production: 2000,
      development: 20,
      test: 8,
    };

    return adjustInterval[process.env.NODE_ENV || 'development'];
  }

  static getHalvingInterval() {
    const halvingInterval = {
      production: 1000000,
      development: 500000,
      test: 10,
    };

    return halvingInterval[process.env.NODE_ENV || 'development'];
  }

  static getExpectedTimePerBlock() {
    const expectedTime = {
      production: 200000,
      development: 5000,
      test: 1000,
    };

    return expectedTime[process.env.NODE_ENV || 'development'];
  }

  static calculateAdjustFactor(expectedTimePerBlock, medianTimePerBlock) {
    const adjustFactorLimit = 4;

    const factor = expectedTimePerBlock / medianTimePerBlock;
    const max = adjustFactorLimit;
    const min = 1 / adjustFactorLimit;

    return clamp(factor, min, max);
  }

  getAccountBalance(address) {
    debug(`Get account balance for ${address}`);
    const account = this.accounts[serializeBuffer(address)];

    if (!account) {
      return 0n;
    }

    return account.balance;
  }

  getAccountTransactions(address) {
    const account = this.accounts[serializeBuffer(address)];

    if (!account) {
      return [];
    }

    return account.transactions;
  }

  transactionUpdate(transaction) {
    if (transaction.getSenderKey()) {
      const senderAddress = generateAddressEncoded(transaction.getSenderKey());

      if (!this.accounts[senderAddress]) {
        // Sender has no transaction history
        // No balance to send
        return false;
      }

      const sufficientBalance = this.accounts[senderAddress].balance - transaction.getAmount() >= 0n;

      if (!sufficientBalance) {
        return false;
      }

      this.accounts[senderAddress].transactions.push(transaction.getIdHex());
      this.accounts[senderAddress].balance -= transaction.getAmount();
    }

    const receiverAddress = serializeBuffer(transaction.getReceiverAddress());

    if (!this.accounts[receiverAddress]) {
      this.accounts[receiverAddress] = {
        balance: 0n,
        transactions: [],
      };
    }

    this.accounts[receiverAddress].transactions.push(transaction.getIdHex());
    this.accounts[receiverAddress].balance += transaction.getAmount();

    return true;
  }

  transactionRevert(transaction) {
    if (transaction.getSenderKey()) {
      const senderAddress = generateAddressEncoded(transaction.getSenderKey());

      this.accounts[senderAddress].transactions.pop();
      this.accounts[senderAddress].balance += transaction.getAmount();
    }

    const receiverAddress = serializeBuffer(transaction.getReceiverAddress());

    this.accounts[receiverAddress].transactions.pop();
    this.accounts[receiverAddress].balance -= transaction.getAmount();

    if (this.accounts[receiverAddress].transactions.length === 0) {
      delete this.accounts[receiverAddress];
    }
  }

  // Update account balances from transactions of a block
  updateBlockBalances(block) {
    let valid = true;
    let i = 0;

    for (; i < block.getTransactionCount(); i += 1) {
      valid = this.transactionUpdate(block.getTransaction(i));

      if (!valid) {
        break;
      }
    }

    if (valid) {
      return true;
    }

    for (i -= 1; i >= 0; i -= 1) {
      this.transactionRevert(block.getTransaction(i));
    }

    return false;
  }

  // Undo updateBlockBalance
  revertBlockBalances(block) {
    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      this.transactionRevert(block.getTransaction(i));
    }
  }

  // Revert chain to previous blocks length
  // Update the account balance and header
  // To use this method only on copies of main chain
  async revertHeaderIndex(index) {
    if (index <= this.getLength()) {
      return false;
    }

    for (let i = this.getLength(); i > index; i -= 1) {
      const block = await Block.load(this.getBlockHeader(i));
      this.revertBlockBalances(block);
    }

    return true;
  }

  lastBlockHeader() {
    return this.blockHeaders[this.getLength() - 1];
  }

  getBlockHeaders() {
    return this.blockHeaders;
  }

  getBlockHeader(i) {
    return this.blockHeaders[i];
  }

  addBlockHeader(header) {
    const isFirst = this.getLength() === 0;
    const lastHeader = this.lastBlockHeader();

    if (!isFirst && !header.getPrevious().equals(lastHeader.getHash())) {
      // console.log(isFirst, lastHeader.getHas(), header.getPrevious());
      // TODO: Handle error on synching
      return false;
    }

    this.blockHeaders.push(header);

    return true;
  }

  async confirmNewBlock(block) {
    if (!block.verify(Chain.currentBlockReward())) {
      debug(`Failed to confirm new block: Incorrect block reward (${Chain.currentBlockReward()},${Chain.mainChain.getLength()})`);
      return false;
    }

    const isFirst = this.getLength() === 0;
    if (!isFirst && !block.getHeader().getPrevious().equals(this.lastBlockHeader().getHash())) {
      debug('Failed to confirm new block: Does not match latest hash');
      return false;
    }

    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      const transaction = block.getTransaction(i);

      const isSaved = await transaction.isSaved();

      if (isSaved) {
        return false;
      }

      await transaction.save();

      // Remove pending transactions, except coinbase
      if (transaction.getSenderKey()) {
        await Transaction.clear(transaction.getId(), true);
      }
    }

    await block.save();

    this.addBlockHeader(block.getHeader());
    await Chain.save(this);

    const result = this.updateBlockBalances(block);

    if (!result) {
      debug('Failed to confirm new block: Insufficient balances');
      return false;
    }

    return true;
  }

  setBlockHeaders(headers) {
    this.blockHeaders = headers;
  }

  verifyGenesisBlock() {
    return this.getBlockHeader(0).equals(Block.Genesis.getHeader());
  }

  // TODO:
  verify() {
    if (!this.verifyGenesisBlock()) {
      return false;
    }

    if (!this.verifyBalances()) {
      console.log('Failed balance verification');
      return false;
    }

    return true;
  }

  getLength() {
    return this.blockHeaders.length;
  }

  // TODO: Rename to next block reward
  static currentBlockReward() {
    return this.blockRewardAtIndex(Chain.mainChain.getLength());
  }

  static nextBlockReward() {
    return this.blockRewardAtIndex(Chain.mainChain.getLength() + 1);
  }

  static blockRewardAtIndex(index) {
    const initialReward = Block.InitialReward;
    const halves = Math.floor(index / Chain.getHalvingInterval());

    return initialReward / BigInt(2 ** halves);
  }

  getTotalWork() {
    let totalWork = 0;

    for (let i = 0; i < this.getLength(); i += 1) {
      totalWork += this.getBlockHeader(i).getDifficulty();
    }

    return totalWork;
  }

  getAverageBlockTime() {
    const headers = this.getBlockHeaders();

    if (headers.length < 2) {
      return 0;
    }

    let totalDiff = 0;

    for (let i = 1; i < headers.length; i += 1) {
      const diff = headers[i].getTime() - headers[i - 1].getTime();
      assert(diff >= 0);

      totalDiff += diff;
    }

    return totalDiff / (headers.length - 1);
  }

  getCurrentDifficulty() {
    let difficulty = 1.0;
    const headers = this.getBlockHeaders();
    if (headers.length < 2) {
      return difficulty;
    }

    const adjustInterval = Chain.getAdjustInterval();
    const expectedTimePerBlock = Chain.getExpectedTimePerBlock(); // Milliseconds

    // let totalDiff = 0;
    const timeDifferences = [];

    // TODO: Static difficulty of 1 on first interval
    for (let i = 1; i < headers.length; i += 1) {
      timeDifferences.push(headers[i].getTime() - headers[i - 1].getTime());

      const timeToAdjust = i % adjustInterval === 0;

      if (timeToAdjust) {
        assert(timeDifferences.length === Chain.getAdjustInterval());

        const medianTimePerBlock = median(timeDifferences);
        const adjustFactor = Chain.calculateAdjustFactor(expectedTimePerBlock, medianTimePerBlock);

        difficulty *= adjustFactor;

        // Clear differences array for next adjustInterval n block
        // timeDifferences = timeDifferences.splice(-1);
        timeDifferences.length = 0;
      }
    }

    return difficulty;
  }

  latestBlockHeader() {
    assert(this.blockHeaders.length > 0);
    assert(this.blockHeaders[this.blockHeaders.length - 1] != null);

    return this.blockHeaders[this.blockHeaders.length - 1];
  }

  static async save(chain) {
    const key = 'chain';
    const data = {
      blockHashes: chain.getBlockHeaders().map((header) => serializeBuffer(header.getHash())),
    };

    await DB.put(key, data, { valueEncoding: 'json' });

    Chain.mainChain = chain;
    return { key, data };
  }

  static async loadHeaders(blockHashes) {
    const promises = [];

    for (let i = 0; i < blockHashes.length; i += 1) {
      promises.push(new Promise((resolve) => {
        resolve(Header.load(blockHashes[i]));
      }));
    }

    const headers = await Promise.all(promises);
    return headers;
  }

  static async load() {
    let data;

    const chain = new Chain();
    let blockHashes = [];

    try {
      data = await DB.get('chain', { valueEncoding: 'json' });
      blockHashes = data.blockHashes.map((hexKey) => deserializeBuffer(hexKey));
    } catch (e) {
      // Do nothing. Leave array empty
    }

    const headers = await Chain.loadHeaders(blockHashes);
    chain.setBlockHeaders(headers);

    return chain;
  }

  async verifyBalances() {
    for (let i = 0; i < this.getLength(); i += 1) {
      // const headers = Chain.mainChain.getHea
      const block = await Block.load(this.getBlockHeader(i).getHash());

      // FIXME: Has return null
      if (block) {
        this.updateBlockBalances(block);
      }
    }
  }

  static async clear() {
    await PendingTransactionDB.clear();
    await Transaction.clearAll();
    // FIXME: Clear using model method
    await HeaderDB.clear(); // TODO: Add test
    await BlockDB.clear();
    await DB.del('chain');

    await Chain.initializeGenesisBlock();
    Chain.mainChain = await Chain.load();
  }

  static isSynching() {
    return Chain.synching;
  }

  static setSynching(synching) {
    Chain.synching = synching;
  }

  // Clear rejected block data in diverging chain
  static async clearRejectedBlocks(chain, startIndex) {
    const clearBlocks = [];
    for (let x = startIndex; x < chain.getLength(); x += 1) {
      clearBlocks.push(chain.getBlockHeader(x).getHash());
    }

    clearBlocks.forEach(async (hash) => {
      debug(`Clear rejected block: ${serializeBuffer(hash)}`);
      await Block.clear(hash);
    });

    return clearBlocks;
  }

  static async initializeGenesisBlock() {
    const chain = await Chain.load();
    if (chain.getLength() > 0) {
      return;
    }

    const block = Block.Genesis;
    await block.save();

    chain.addBlockHeader(block.getHeader());
    await Chain.save(chain);
  }

  static compareWork(currentChain, newChain) {
    const currentWork = currentChain.getTotalWork();
    const newWork = newChain.getTotalWork();
    // FIXME:

    if (newWork === 0) {
      return -1;
    }

    debug(`Compare block work. Current: ${currentWork}, New: ${newWork}`);
    const isAhead = newWork >= currentWork + currentChain.getCurrentDifficulty();

    if (!isAhead) {
      return -1;
    }

    let i = 0;

    for (; i < currentChain.getLength(); i += 1) {
      if (!currentChain.getBlockHeader(i).getHash().equals(newChain.getBlockHeader(i).getHash())) {
        // Diverge index
        return i;
      }
    }

    // Update start index
    return i;
  }

  toObject() {
    const data = {
      blockHeaders: this.blockHeaders.map((header) => header.toObject()),
    };

    return data;
  }

  static fromObject(obj) {
    const chain = new Chain();

    for (let i = 0; i < obj.blockHeaders.length; i += 1) {
      chain.addBlockHeader(Header.fromObject(obj.blockHeaders[i]));
    }

    return chain;
  }
}

Chain.mainChain = new Chain();
Chain.synching = false;

module.exports = Chain;
