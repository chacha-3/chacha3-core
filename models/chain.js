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

  static async save(chain) {
    const key = 'chain';

    const data = {
      blockHashes: chain.getBlockHashes().map((hash) => hash.toString('hex')),
    };

    await DB.put(key, data, { valueEncoding: 'json' });

    return { key, data };
  }

  static async load() {
    let data;

    try {
      data = await DB.get('chain', { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const chain = new Chain();

    const blockHashes = data.blockHashes.map((hexKey) => Buffer.from(hexKey, 'hex'));
    chain.setBlockHashes(blockHashes);

    return chain;
  }
}

module.exports = Chain;
