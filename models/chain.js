const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

class Chain {
  constructor() {
    this.blocksKeys = [];
    this.blockCount = 0;
  }

  addBlockKey(key) {
    this.blocksKeys.push(key);
    this.blockCount += 1;
  }

  verify() {

  }
}

module.exports = Chain;
