const assert = require('assert');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

class Block {
  constructor() {
    this.header = new Header();
    this.transactionCount = 0n;
    this.transactions = [];

    // this.coinbase = new Transaction();
  }

  addCoinbase(receiverAddress) {
    const transaction = new Transaction(null, receiverAddress, 100);
    this.addTransaction(transaction);
  }

  addTransaction(transaction) {
    if (transaction.getSignature() == null) {
      assert.strictEqual(this.transactionCount, 0n);
    }

    this.transactions.push(transaction);
    this.transactionCount += BigInt(1);
  }

  getTransaction(index) {
    return this.transactions[index];
  }

  getHeader() {
    return this.header;
  }

  mine() {
    while (!this.verifyHash()) {
      this.header.incrementNonce();
    }
  }

  verifyHash() {
    const hashNum = new BN(this.header.getHash(), 16);
    const targetNum = new BN(this.header.getTarget(), 16);

    return hashNum.lt(targetNum);
  }

  verify() {
    // TODO: Verify transactions signature
    return this.verifyHash();
  }

  toObject() {
    const data = {
      header: this.getHeader().toObject(),
      transactionCount: this.transactionCount,
      transactions: [],
    };

    for (let i = 0; i < this.transactionCount; i += 1) {
      const transaction = this.transactions[i];
      data.transactions.push(transaction.toObject());
    }

    return data;
  }
}

module.exports = Block;
