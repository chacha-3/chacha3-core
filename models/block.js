const Header = require('./header');

class Block {
  constructor() {
    this.header = new Header();
    this.transactionCount = 0n;
    this.transactions = [];
  }
}

module.exports = Block;