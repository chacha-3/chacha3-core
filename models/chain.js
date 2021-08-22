const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

const { DB, BlockDB, runningManualTest } = require('../util/db');
const { median, clamp } = require('../util/math');

const Block = require('./block');

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

class Chain {
  constructor() {
    this.blockHeaders = [];
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
    // let totalWork = 0;

    try {
      data = await DB.get('chain', { valueEncoding: 'json' });
      // totalWork = data.totalWork;
      blockHashes = data.blockHashes.map((hexKey) => Buffer.from(hexKey, 'hex'));
    } catch (e) {
      // return null;
    }

    const headers = await Chain.loadHeaders(blockHashes);

    chain.setBlockHeaders(headers);
    return chain;
  }

  static async clear() {
    await BlockDB.clear();
    await DB.del('chain');
  }
}

module.exports = Chain;
