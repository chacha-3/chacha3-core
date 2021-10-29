const debug = require('debug')('chain:model');
const assert = require('assert');

const Header = require('./header');

const {
  DB, BlockDB, HeaderDB, runningManualTest, PendingTransactionDB,
} = require('../util/db');
const { serializeBuffer, deserializeBuffer, serializeObject } = require('../util/serialize');

const { median, clamp } = require('../util/math');

const Block = require('./block');
const { generateAddressEncoded } = require('./wallet');
const Transaction = require('./transaction');
const { Genesis } = require('./block');
const { timeStamp } = require('console');

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

class Chain {
  constructor() {
    this.blockHeaders = [Block.Genesis.getHeader()];
    this.accounts = {};

    this.updateBlockBalances(Block.Genesis);

    this.synching = false;
  }

  static getAdjustInterval() {
    const adjustInterval = {
      production: 2000,
      development: 20,
      test: 8,
    };

    return adjustInterval[process.env.NODE_ENV || 'development'];
  }

  // TODO: Change to static get
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
    debug(`Get account balance for ${address.toString('hex')}`);
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

  // // Revert chain to previous blocks length
  // // Update the account balance and header
  // // To use this method only on copies of main chain
  // async revertHeaderIndex(index) {
  //   if (index >= this.getLength()) {
  //     return false;
  //   }
    
  //   console.log(index, this.getLength())
  //   for (let i = this.getLength() - 1; i > index; i -= 1) {
  //     console.log(i);
  //     const block = await Block.load(this.getBlockHeader(i));
  //     this.revertBlockBalances(block);
  //     console.log(`Revert: ${i}`);
  //   }

  //   return true;
  // }

  lastBlockHeader() {
    if (this.getLength() === 0) {
      return null;
    }

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

  // verifyNewBlock(newBlock) {
  //   if (!newBlock.verify(this.lastBlockHeader(), this.currentBlockReward())) {
  //     return false;
  //   }

  //   return true;
  // }

  // NOTE: Main chain
  async confirmNewBlock(block) {
    console.log(block);
    // Add validate new block function to check previous hash, reward, and timestamp
    if (!block.verify(this.lastBlockHeader(), Chain.mainChain.currentBlockReward())) {
      debug('New block failed verification');
      return false;
    }

    const isFirst = this.getLength() === 0;
    const blockPrevious = block.getHeader().getPrevious();

    if (!isFirst && !this.lastBlockHeader().getHash().equals(blockPrevious)) {
      debug(`Failed to confirm new block: Does not match latest hash, ${this.lastBlockHeader().getHash('hex')}, ${blockPrevious.toString('hex')}`);
      return false;
    }

    // FIXME: Duplicate of block.verifyTransactions()
    // const noPriorTransactions = await block.hasNoExistingTransactions();

    // if (!noPriorTransactions) {
    //   return false;
    // }

    debug(`Saved new block: ${block.getHeader().getHash().toString('hex')}`);
    await block.save();

    assert(block.getHeader() !== null);
    this.addBlockHeader(block.getHeader());

    console.log(this);
    await Chain.save(this);

    const result = this.updateBlockBalances(block);

    if (!result) {
      debug('Failed to confirm new block: Insufficient balances');
      return false;
    }

    await block.clearPendingTransactions();

    return true;
  }

  setBlockHeaders(headers) {
    this.blockHeaders = headers;
  }

  verifyGenesisBlock() {
    return this.getBlockHeader(0).equals(Block.Genesis.getHeader());
  }

  // TODO:
  // Verify and load balances
  async verify() {
    // TODO: Assert not block balances set

    if (!this.verifyGenesisBlock()) {
      return false;
    }

    for (let i = 0; i < this.getLength(); i += 1) {
      const block = await Block.load(this.getBlockHeader(i).getHash());

      // FIXME:
      // if (!block.verify(Chain.blockRewardAtIndex(i))) {
      //   return false;
      // }

      if (!this.updateBlockBalances(block)) {
        return false;
      }
    }

    // TODO: Verify block rewards

    return true;
  }

  getLength() {
    return this.blockHeaders.length;
  }

  currentBlockReward() {
    return Chain.blockRewardAtIndex(this.getLength());
  }

  nextBlockReward() {
    return Chain.blockRewardAtIndex(this.getLength() + 1);
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

  // TODO: Remove
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

  // NOTE: Main chain
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

  // TODO: Remove. Combine all verification in loop
  // async verifyBalances() {
  //   for (let i = 0; i < this.getLength(); i += 1) {
  //     // const headers = Chain.mainChain.getHea
  //     const block = await Block.load(this.getBlockHeader(i).getHash());

  //     if (block) {
  //       this.updateBlockBalances(block);
  //     }
  //   }
  // }

  static async clearMain() {
    // FIXME: Should not have to clear pending transactions
    await PendingTransactionDB.clear();
    await Transaction.clearAll();
    // FIXME: Clear using model method
    await HeaderDB.clear(); // TODO: Add test
    await BlockDB.clear();

    await Chain.mainChain.clearBlocks();
    await DB.del('chain');

    await Chain.initializeGenesisBlock();
    Chain.mainChain = await Chain.load();
  }

  isSynching() {
    return this.synching;
  }

  setSynching(synching) {
    this.synching = synching;
  }

  async clearBlocks(startIndex = 0) {
    const clearBlock = (hash) => new Promise((resolve) => {
      debug(`Clear rejected block: ${serializeBuffer(hash)}`);
      Block.clear(hash).then(() => resolve(hash));
    });

    const promises = [];

    for (let x = startIndex; x < this.getLength(); x += 1) {
      promises.push(clearBlock(this.getBlockHeader(x).getHash()));
    }

    return Promise.all(promises);
  }

  // Clear rejected block data in diverging chain
  // static async clearRejectedBlocks(chain, startIndex) {
  //   const clearBlocks = [];
  //   for (let x = startIndex; x < chain.getLength(); x += 1) {
  //     clearBlocks.push(chain.getBlockHeader(x).getHash());
  //   }

  //   clearBlocks.forEach(async (hash) => {
  //     debug(`Clear rejected block: ${serializeBuffer(hash)}`);
  //     await Block.clear(hash);
  //   });

  //   return clearBlocks;
  // }

  // NOTE: Main chain
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

  compareWork(newChain) {
    const currentWork = this.getTotalWork();
    const newWork = newChain.getTotalWork();

    debug(`Compare block work. Current: ${currentWork}, New: ${newWork}`);
    const isAhead = newWork >= currentWork + this.getCurrentDifficulty();

    if (!isAhead) {
      return -1;
    }

    let i = 0;

    for (; i < this.getLength(); i += 1) {
      if (!this.getBlockHeader(i).getHash().equals(newChain.getBlockHeader(i).getHash())) {
        // Diverge index
        return i;
      }
    }

    // Update start index
    return i;
  }

  // static async syncMainWith(newChain) {
    

    

  //   // const divergeIndex = Chain.mainChain.compareWork(newChain);

    

  //   // const valid = await this.verifyForwardBlocks(newChain, divergeIndex);

   

  //   return true;
  // }

  toObject() {
    const data = {
      blockHeaders: this.blockHeaders.map((header) => header.toObject()),
    };

    return data;
  }

  static fromObject(obj) {
    const chain = new Chain();

    for (let i = 0; i < obj.blockHeaders.length; i += 1) {
      const header = Header.fromObject(obj.blockHeaders[i]);
      assert(header != null);

      chain.addBlockHeader(header);
    }

    return chain;
  }
}

Chain.mainChain = new Chain();
// Chain.synching = false;

module.exports = Chain;
