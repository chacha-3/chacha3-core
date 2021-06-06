const { assert } = require('chai');
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

  addCoinbase(receiver) {
    const transaction = new Transaction(null, receiver, 100);
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

  mine() {
    let hashNum = new BN(this.header.getHash(), 16);
    let targetNum = new BN(this.header.getTarget(), 16);

    while (hashNum.gte(targetNum)) {
      this.header.incrementNonce();
      hashNum = new BN(this.header.getHash(), 16);
    }

    console.log(this.header.nonce);
  }

  verify() {
    
  }
}

module.exports = Block;