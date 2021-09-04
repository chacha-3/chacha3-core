const debug = require('debug')('chain:model');
const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

const { DB, BlockDB, runningManualTest } = require('../util/db');
const { median, clamp } = require('../util/math');

const Block = require('./block');
const { generateAddressEncoded } = require('./wallet');

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

  static getExpectedTimePerBlock() {
    const expectedTime = {
      production: 200000,
      development: 1000,
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
    const account = this.accounts[address];

    debug(`Found account balance: ${JSON.stringify(account)}`);
    if (!account) {
      return 0;
    }

    return account.balance;
  }

  getAccountTransactions(address) {
    const account = this.accounts[address];

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

      const sufficientBalance = this.accounts[senderAddress].balance - transaction.getAmount() >= 0;

      if (!sufficientBalance) {
        return false;
      }

      this.accounts[senderAddress].transactions.push(transaction.getIdHex());
      this.accounts[senderAddress].balance -= transaction.getAmount();
    }

    const receiverAddress = transaction.getReceiverAddress();

    if (!this.accounts[receiverAddress]) {
      this.accounts[receiverAddress] = {
        balance: 0,
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

    const receiverAddress = transaction.getReceiverAddress();
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

  getBlockHeaders() {
    return this.blockHeaders;
  }

  getBlockHeader(i) {
    return this.blockHeaders[i];
  }

  addBlockHeader(header) {
    this.blockHeaders.push(header);
  }

  setBlockHeaders(headers) {
    this.blockHeaders = headers;
  }

  verify() {

  }

  getLength() {
    return this.blockHeaders.length;
  }

  blockRewardAtIndex(index) {
    // TODO: Add later
    // Not a real formula
    if (this.getLength() >= 0) {
      return 10000;
    }

    return 0;
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

    for (let i = 1; i < headers.length; i += 1) {
      const timeToAdjust = i % adjustInterval === 0;

      if (timeToAdjust) {
        const medianTimePerBlock = median(timeDifferences);
        const adjustFactor = Chain.calculateAdjustFactor(expectedTimePerBlock, medianTimePerBlock);

        difficulty *= adjustFactor;

        // Clear differences array for next adjustInterval n block
        timeDifferences.length = 0;
      }

      timeDifferences.push(headers[i].getTime() - headers[i - 1].getTime());
    }

    return difficulty;
  }

  latestBlockHeader() {
    return this.blockHeaders[this.blockHeaders.length - 1];
  }

  static async save(chain) {
    const key = 'chain';
    const data = {
      blockHashes: chain.getBlockHeaders().map((header) => header.getHash().toString('hex')),
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
      blockHashes = data.blockHashes.map((hexKey) => Buffer.from(hexKey, 'hex'));
    } catch (e) {
      console.log('Error load chain');
      // FIXME: Comes here when there is no existing chain
      // return null;
    }

    const headers = await Chain.loadHeaders(blockHashes);
    chain.setBlockHeaders(headers);

    return chain;
  }

  static async clear() {
    Chain.mainChain = new Chain();

    await BlockDB.clear();
    await DB.del('chain');
  }

  static async clearRejectedBlocks(chain, startIndex) {
    const clearBlocks = [];
    for (let x = startIndex; x < chain.getLength(); x += 1) {
      clearBlocks.push(chain.getBlockHeader(x).getHash());
    }

    debug('Chain up to latest');
    await Chain.save(chain);

    clearBlocks.forEach((hash) => {
      debug(`Clear rejected block: ${hash.toString('hex')}`);
      Block.clear(hash);
    });
  }

  static async verifyForwardBlocks(peer, pulledChain, startIndex) {
    let valid = true;

    debug(`Diverge index: ${startIndex}. Pulled chain length: ${pulledChain.getLength()}`);
    for (let j = startIndex; j < pulledChain.getLength() && valid; j += 1) {
      const header = pulledChain.getBlockHeader(j);

      debug(`Request block data: ${header.getHash().toString('hex')}`);
      debug(`Peer info: ${peer.getAddress()}:${peer.getPort()}`);
      const { data } = await peer.callAction('blockInfo', { hash: header.getHash().toString('hex') });
      debug(`Receive new block data: ${header.getHash().toString('hex')}`);

      if (data) {
        debug('Receive data for block');
        const block = Block.fromObject(data);
        valid = Block.verifyAndSave(block);
      } else {
        debug('No data');
      }
    }

    if (!valid) {
      // TODO: Clear blocks
    }

    return valid;
  }

  static async syncWithPeer(peer) {
    const { data } = await peer.callAction('pullChain');

    const pulledChain = Chain.fromObject(data);
    const divergeIndex = Chain.compareWork(Chain.mainChain, pulledChain);

    if (divergeIndex < 0) {
      return false;
    }

    const valid = Chain.verifyForwardBlocks(peer, pulledChain, divergeIndex);

    if (valid) {
      Chain.clearRejectedBlocks(Chain.mainChain, divergeIndex);
    } else {
      debug('Invalid chain');
    }

    return valid;
  }
  // static async acceptNewChain()
  // static async acceptNewChain(currentChain, newChain, sourcePeer) {
  //   const divergeIndex = this.compareWork(currentChain, newChain);
  //   if (divergeIndex < 0) {
  //     return false;
  //   }

  //   // TODO: Check new blocks are valid
  //   for (let i = divergeIndex; i < newChain.getLength(); i += 1) {
  //     const hash = newChain.getBlockHeader(i);
  //     const blockData = await sourcePeer.callAction('blockInfo', {hash});

  //     const newBlock = Block.fromObject(blockData);
  //     await Block.save(newBlock)
  //   }
  // }

  static async initializeGenesisBlock() {
    if (Chain.load() != null) {
      return;
    }

    const chain = new Chain();

    const block = Block.Genesis;
    await Block.save(block);

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

module.exports = Chain;
