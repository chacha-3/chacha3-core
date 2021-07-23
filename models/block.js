const assert = require('assert');
const crypto = require('crypto');
const BN = require('bn.js');

const Header = require('./header');
const Transaction = require('./transaction');

class Block {
  constructor() {
    this.header = new Header();
    this.transactionCount = 0n;
    this.transactions = [];

    // this.lastChecksum = Buffer.from([]);

    // this.coinbase = new Transaction();
  }

  addCoinbase(receiverAddress) {
    const transaction = new Transaction(null, receiverAddress, 100);
    this.addTransaction(transaction);
  }

  addTransaction(transaction) {
    // Only the coinbase transaction can be added without signature
    if (transaction.getSignature() == null) {
      assert.strictEqual(this.transactionCount, 0n);
    }

    this.transactions.push(transaction);
    this.transactionCount += BigInt(1);

    this.updateChecksum(transaction.getId());
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
    assert(this.transactionCount > 0);

    const hashNum = new BN(this.header.getHash(), 16);
    const targetNum = new BN(this.header.getTarget(), 16);

    return hashNum.lt(targetNum);
  }

  verify() {
    return this.verifyHash() && this.verifyChecksum();
  }

  updateChecksum(newTransactionId) {
    assert(newTransactionId != null);

    const lastChecksum = this.header.getChecksum() || Buffer.from([]);

    const fingerprint = Buffer.concat([lastChecksum, newTransactionId]);
    const newChecksum = crypto.createHash('SHA256').update(fingerprint).digest();

    this.header.setChecksum(newChecksum);
  }

  verifyChecksum() {
    let lastChecksum = Buffer.from([]);

    for (let i = 0; i < this.transactionCount; i += 1) {
      const transaction = this.transactions[i];
      const fingerprint = Buffer.concat([lastChecksum, transaction.getId()]);

      lastChecksum = crypto.createHash('SHA256').update(fingerprint).digest();
    }

    return this.getHeader().getChecksum().equals(lastChecksum);
  }

  verifySize() {
    // TODO:
  }

  verifyTimestamp() {
    // TODO: For new blocks, ensure less than two hours into future for time errors
  }

  verifyOnlyFirstIsCoinBase() {

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
