const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

class Chain {
  constructor() {
    // this.header = new Header();
    // this.transactionCount = 0n;
    this.transactions = [];

    // this.lastChecksum = Buffer.from([]);

    // this.coinbase = new Transaction();
  }
}

module.exports = Chain;
