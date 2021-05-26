const Header = require('./header');
const Transaction = require('./transaction');

class Block {
  constructor() {
    this.header = new Header();
    this.transactionCount = 0n;
    this.transactions = [];
    
    // this.coinbase = new Transaction();
  }
}

module.exports = Block;