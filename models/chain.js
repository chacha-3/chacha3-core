const debug = require('debug')('chain:model');
const assert = require('assert');

const Header = require('./header');

const {
  DB, BlockDB, HeaderDB, runningManualTest, PendingTransactionDB,
} = require('../util/db');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');

const { median, clamp } = require('../util/math');

const Block = require('./block');
const { generateAddressEncoded } = require('./wallet');
const Transaction = require('./transaction');

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

class Chain {
  constructor() {
    this.blockHeaders = [Block.Genesis.getHeader()];
    this.accounts = {};

    // TODO: Add test to check genesis block balance not loaded.
    // Only load during verification
    // this.updateBlockBalances(Block.Genesis);

    this.synching = false;
    this.verified = false;
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

  // TODO: expectedTimePerBlock is fixed and should not need to be required as a parameter
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

      const remainingBalance = this.accounts[senderAddress].balance - transaction.getAmount();
      const sufficientBalance = remainingBalance >= 0n;

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

  lastBlockHeader() {
    assert(this.getLength() > 0);
    return this.blockHeaders[this.getLength() - 1];
  }

  getBlockHeaders() {
    return this.blockHeaders;
  }

  getBlockHeader(i) {
    return this.blockHeaders[i];
  }

  // TODO: Rename to isBalanceLoaded()
  isVerified() {
    if (!this.verified) {
      // Account balances not loaded
      assert(Object.keys(this.accounts).length === 0);
    }

    return this.verified;
  }

  setVerified(verified) {
    this.verified = verified;
  }

  addBlockHeader(header) {
    assert(this.getLength() > 0);
    // const lastHeader = this.lastBlockHeader();

    assert(!header.getHash().equals(Block.Genesis.getHeader().getHash()));

    if (header.getDifficulty() < this.getCurrentDifficulty()) {
      return false;
    }

    // FIXME: Should not need to double verify
    // Block is already verified before add block header
    // if (!header.getPrevious().equals(lastHeader.getHash())) {
    //   // TODO: Handle error on synching
    //   // throw Error('Added block header does not match previous hash');
    //   return false;
    // }

    this.blockHeaders.push(header);
    this.setVerified(false);

    return true;
  }

  // NOTE: Main chain
  // Add validate new block function to check previous hash, reward, and timestamp
  async confirmNewBlock(block) {
    const blockVerified = await block.verify(this.lastBlockHeader(), this.currentBlockReward());
    if (!blockVerified) {
      debug(`New block failed verification: ${serializeBuffer(block.getHeader().getHash())}`);
      return false;
    }

    debug(`Saved new block: ${block.getHeader().getHash().toString('hex')}`);
    await block.save();

    assert(block.getHeader() !== null);

    const addedHeader = this.addBlockHeader(block.getHeader());

    // Would be false if previous block does not match
    // As block is verified, return false this should be an impossible case
    assert(addedHeader === true);

    const result = this.updateBlockBalances(block);

    if (!result) {
      debug('Failed to confirm new block: Insufficient balances');
      await Block.clear(block.getHeader().getHash());
      return false;
    }

    this.setVerified(true);

    // TODO: Move out chain save from instance?
    // await Chain.save(this);

    await block.clearPendingTransactions();

    return true;
  }

  setBlockHeaders(headers) {
    this.blockHeaders = headers;
  }

  verifyGenesisBlock() {
    return this.getBlockHeader(0).equals(Block.Genesis.getHeader());
  }

  verifyHeaders() {
    let { hash, time } = Block.Genesis.header;

    // Skip verify genesis
    // TODO: Merge verification
    for (let i = 1; i < this.getLength(); i += 1) {
      const header = this.getBlockHeader(i);

      if (!header.getPrevious().equals(hash)) {
        return false;
      }

      // TODO: Determine timestamp verification
      if (header.getTime() < time) {
        return false;
      }

      hash = header.getHash();
      time = header.getTime();
    }

    return true;
  }

  // Verify and load balances
  // Note: Modifies balance. Destructive
  async loadBalances() {
    // TODO: Assert not block balances set
    assert(!this.isVerified());
    assert(this.verifyGenesisBlock());

    for (let i = 0; i < this.getLength(); i += 1) {
      const block = await Block.load(this.getBlockHeader(i).getHash());
      assert(block !== null);

      const result = this.updateBlockBalances(block);
      assert(result);
    }

    // TODO: Verify block rewards

    this.setVerified(true);
    // return true;
  }

  getLength() {
    return this.blockHeaders.length;
  }

  currentBlockReward() {
    // Current reward is latest block index + 1, hence length
    return Chain.blockRewardAtIndex(this.getLength());
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

  async save() {
    const key = 'chain';
    const data = {
      blockHashes: this.getBlockHeaders().map((header) => serializeBuffer(header.getHash())),
    };

    await DB.put(key, data, { valueEncoding: 'json' });

    Chain.mainChain = this;
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

    // TODO: Revise this
    // Overrides genesis only chain
    // Perhaps use addBlockHeader instead of set blocks, for verification
    if (headers.length > 0) {
      chain.setBlockHeaders(headers);
    }

    return chain;
  }

  async clear(isMain = false) {
    const clearHeader = (hash) => new Promise((resolve) => {
      Header.clear(hash).then(() => resolve(hash));
    });

    const clearBlock = (hash) => new Promise((resolve) => {
      Block.clear(hash).then(() => resolve(hash));
    });

    const promises = [];

    for (let x = 0; x < this.getLength(); x += 1) {
      promises.push(clearBlock(this.getBlockHeader(x).getHash()));
      promises.push(clearHeader(this.getBlockHeader(x).getHash()));
    }

    await Promise.all(promises);

    this.setBlockHeaders([]);
    this.accounts = {};

    this.synching = false;
    this.verified = false;

    if (isMain) {
      await DB.del('chain');
      Chain.mainChain = await Chain.load();
    }
  }

  // Change to Chain.mainChain.clear();
  static async clearMain() {
    await Chain.mainChain.clear(true);

    await DB.del('chain');

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

  toObject() {
    const data = {
      blockHeaders: this.blockHeaders.map((header) => header.toObject()),
    };

    return data;
  }

  static fromObject(obj) {
    const chain = new Chain();

    const { blockHeaders } = obj;
    assert(blockHeaders.length > 0);

    const genesis = Header.fromObject(obj.blockHeaders[0]);
    assert(genesis.getHash().equals(Block.Genesis.getHeader().getHash()));

    for (let i = 1; i < blockHeaders.length; i += 1) {
      const header = Header.fromObject(blockHeaders[i]);
      assert(header != null);

      const result = chain.addBlockHeader(header);
      // assert(result === true);
    }

    return chain;
  }
}

Chain.mainChain = new Chain();
// Chain.synching = false;

module.exports = Chain;
