const debug = require('debug')('chain:model');
const assert = require('assert');

const Header = require('./header');
const { config, Env } = require('../util/env');

const { Testing, Development, Production } = Env;

const {
  DB,
} = require('../util/db');
const {
  serializeBuffer, packIndexArray, packObject, unpackObject, unpackIndexArray,
} = require('../util/serialize');

const { median, clamp } = require('../util/math');

const Block = require('./block');
const { generateAddressEncoded } = require('./wallet');

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

  // Interval in which difficulty is adjusted
  static getAdjustInterval() {
    const { environment } = config;

    const adjustInterval = {
      [Production]: 2000,
      [Development]: 20,
      [Testing]: 8,
    };

    return adjustInterval[environment];
  }

  // TODO: Change to static get
  static getHalvingInterval() {
    const { environment } = config;

    const halvingInterval = {
      [Production]: 1000000,
      [Development]: 500000,
      [Testing]: 10,
    };

    return halvingInterval[environment];
  }

  static getExpectedTimePerBlock() {
    const { environment } = config;

    const expectedTime = {
      [Production]: 60000, // TODO: Set
      [Development]: 30000,
      [Testing]: 1000,
    };

    return expectedTime[environment];
  }

  // TODO: expectedTimePerBlock is fixed and should not need to be required as a parameter
  static calculateAdjustFactor(expectedTimePerBlock, medianTimePerBlock) {
    const adjustFactorLimit = 4;

    const factor = expectedTimePerBlock / medianTimePerBlock;
    const max = adjustFactorLimit;
    const min = 1 / adjustFactorLimit;

    return clamp(factor, min, max);
  }

  getAccountData(address) {
    return this.accounts[serializeBuffer(address)] || null;
  }

  getAccountBalance(address) {
    debug(`Get account balance for ${address.toString('hex')}`);
    const account = this.getAccountData(address);

    if (!account) {
      return 0n;
    }

    return account.balance;
  }

  getAccountTransactions(address) {
    assert(address !== null);
    const account = this.getAccountData(address);

    if (!account) {
      return [];
    }

    return account.transactions;
  }

  transactionUpdate(transaction, feeRewardAddress) {
    assert(feeRewardAddress !== undefined);
    if (transaction.getSenderKey()) {
      const senderAddress = generateAddressEncoded(transaction.getSenderKey());

      if (!this.accounts[senderAddress]) {
        // Sender has no transaction history
        // No balance to send
        return false;
      }

      const amountWithFee = transaction.getAmount() + transaction.getFee();

      const remainingBalance = this.accounts[senderAddress].balance - amountWithFee;
      const sufficientBalance = remainingBalance >= 0n;

      if (!sufficientBalance) {
        return false;
      }

      this.accounts[senderAddress].transactions.push({ id: transaction.getIdHex(), action: 'send' });
      this.accounts[senderAddress].balance -= amountWithFee;
    }

    const receiverAddress = serializeBuffer(transaction.getReceiverAddress());

    if (!this.accounts[receiverAddress]) {
      this.accounts[receiverAddress] = {
        balance: 0n,
        transactions: [],
      };
    }

    const receiveAction = feeRewardAddress === null ? 'mine' : 'receive';

    this.accounts[receiverAddress].transactions.push({
      id: transaction.getIdHex(),
      action: receiveAction,
    });

    this.accounts[receiverAddress].balance += transaction.getAmount();

    if (feeRewardAddress !== null && transaction.getFee() > 0n) {
      const key = serializeBuffer(feeRewardAddress);

      // TODO: Modularize account init
      if (!this.accounts[key]) {
        this.accounts[key] = {
          balance: 0n,
          transactions: [],
        };
      }

      this.accounts[key].transactions.push({ id: transaction.getIdHex(), action: 'fee' });
      this.accounts[key].balance += transaction.getFee();
    }

    return true;
  }

  transactionRevert(transaction, feeRewardAddress) {
    if (transaction.getSenderKey()) {
      const senderAddress = generateAddressEncoded(transaction.getSenderKey());

      this.accounts[senderAddress].transactions.pop();
      this.accounts[senderAddress].balance += transaction.getAmount() + transaction.getFee();
    }

    const receiverAddress = serializeBuffer(transaction.getReceiverAddress());

    this.accounts[receiverAddress].transactions.pop();
    this.accounts[receiverAddress].balance -= transaction.getAmount();

    if (feeRewardAddress !== null && transaction.getFee() > 0n) {
      const key = serializeBuffer(feeRewardAddress);

      this.accounts[key].transactions.pop();
      this.accounts[key].balance -= transaction.getFee();

      if (this.accounts[key].transactions.length === 0) {
        assert(this.accounts[key].balance === 0n);
        delete this.accounts[key];
      }
    }

    if (this.accounts[receiverAddress].transactions.length === 0) {
      delete this.accounts[receiverAddress];
    }
  }

  // Update account balances from transactions of a block
  updateBlockBalances(block) {
    let valid = true;
    let i = 0;

    // let totalFee = 0n;

    const coinbase = block.getCoinbaseTransaction();

    for (; i < block.getTransactionCount(); i += 1) {
      const transaction = block.getTransaction(i);

      valid = this.transactionUpdate(
        transaction,
        (i > 0) ? coinbase.getReceiverAddress() : null,
      );

      if (!valid) {
        break;
      }
    }

    if (valid) {
      return true;
    }

    for (i -= 1; i >= 0; i -= 1) {
      this.transactionRevert(
        block.getTransaction(i),
        (i > 0) ? coinbase.getReceiverAddress() : null,
      );
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
    assert(headers.length > 0);
    assert(headers[0].getHash().equals(Block.Genesis.getHeader().getHash()));

    for (let i = 1; i < headers.length; i += 1) {
      // Use addBlockHeader to perform verification
      this.addBlockHeader(headers[i]);
    }
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
    // FIXME: Quickfix for genesis block not loaded.
    // Possible deleted somewhere.
    await Block.Genesis.save();

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
      blockHashes: packIndexArray(this.getBlockHeaders().map((header) => header.getHash())),
    };

    await DB.put(key, packObject(data), { valueEncoding: 'binary' });

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

    try {
      const loaded = await DB.get('chain', { valueEncoding: 'binary' });
      data = unpackObject(loaded);
    } catch (e) {
      return chain;
    }

    data.blockHashes = unpackIndexArray(data.blockHashes, 32);
    const headers = await Chain.loadHeaders(data.blockHashes);

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

    // TODO: Revise. Should not have empty block header
    this.blockHeaders = [];
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

  clone(start = undefined, end = undefined) {
    const obj = this.toObject();
    obj.blockHeaders = obj.blockHeaders.slice(start, end);

    const chain = Chain.fromObject(obj);
    return chain;
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
