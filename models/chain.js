const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

const { DB, BlockDB } = require('../util/db');
const Block = require('./block');

class Chain {
  constructor() {
    // this.blockHashes = [];
    // this.totalWork = 0;

    this.blockHeaders = [];
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

  // async addBlock(block) {
  //   await Block.save(block);
  //   this.blockHeaders.push(block.getHeader().gethash());
  // }

  // addBlockHash(block) {
  //   const header = block.getHeader();
  //   assert(block.verify() === true);

  //   // TODO: Check timestamp greater than last

  //   this.blockHashes.push(header.getHash());

  //   this.totalWork += header.getDifficulty();
  // }

  // getBlockHashes() {
  //   return this.blockHashes;
  // }

  // setBlockHashes(hashes) {
  //   this.blockHashes = hashes;
  // }

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

  // setTotalWork(totalWork) {
  //   this.totalWork = totalWork;
  // }

  static async save(chain) {
    const key = 'chain';
    const data = {
      // totalWork: chain.getTotalWork(),
      // blockHashes: chain.getBlockHashes().map((hash) => hash.toString('hex')),
      blockHashes: chain.getBlockHeaders().map((header) => header.getHash().toString('hex')),
    };

    await DB.put(key, data, { valueEncoding: 'json' });

    return { key, data };
  }

  static async loadHeaders(blockHashes) {
    const promises = [];

    for (let i = 0; i < blockHashes.length; i += 1) {
      promises.push(new Promise((resolve) => resolve(Header.load(blockHashes[i]))));
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
    // TODO: Clear all blocks
    // const promises = [];

    // let block;
    // while ((block = this.blockHashes.pop()) !== undefined) {
    //   promises.push(Block.clear)
    // }

    await DB.del('chain');
  }
}

module.exports = Chain;
