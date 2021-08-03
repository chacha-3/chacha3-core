const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

const { DB, BlockDB } = require('../util/db');

class Chain {
  constructor() {
    this.blockHashes = [];
    this.totalWork = 0;
  }

  addBlockHash(block) {
    const header = block.getHeader();
    assert(block.verify() === true);

    // TODO: Check timestamp greater than last

    this.blockHashes.push(header.getHash());

    this.totalWork += header.getDifficulty();
  }

  getBlockHashes() {
    return this.blockHashes;
  }

  setBlockHashes(hashes) {
    this.blockHashes = hashes;
  }

  verify() {

  }

  getHeight() {
    return this.blockHashes.length;
  }

  getTotalWork() {
    return this.totalWork;
  }

  setTotalWork(totalWork) {
    this.totalWork = totalWork;
  }

  static async save(chain) {
    const key = 'chain';

    const data = {
      totalWork: chain.getTotalWork(),
      blockHashes: chain.getBlockHashes().map((hash) => hash.toString('hex')),
    };

    await DB.put(key, data, { valueEncoding: 'json' });

    return { key, data };
  }

  static async load() {
    let data;

    const chain = new Chain();
    let blockHashes = [];
    let totalWork = 0;

    try {
      data = await DB.get('chain', { valueEncoding: 'json' });

      totalWork = data.totalWork;
      blockHashes = data.blockHashes.map((hexKey) => Buffer.from(hexKey, 'hex'));
    } catch (e) {
      // return null;
    }

    chain.setBlockHashes(blockHashes);
    chain.setTotalWork(totalWork);

    return chain;
  }

  static async clear() {
    // TODO: Clear all blocks
    await DB.del('chain');
  }
}

module.exports = Chain;
