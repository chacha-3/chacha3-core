const { assert } = require('chai');
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
    let hash = this.header.getHash();

    while (hash[0] != 0x00 || hash[1] != 0x00 || hash[2] != 0x00) {
      this.header.incrementNonce();

      hash = this.header.getHash();
    }

    console.log(this.header.nonce);
    console.log(this.header.getHash().toString('hex'));
  }
}

module.exports = Block;