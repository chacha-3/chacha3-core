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
    this.transactions.push(transaction);
    this.transactionCount += 1;
  }
}

module.exports = Block;