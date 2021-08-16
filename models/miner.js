const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');

// const addressPrefix = '420_';

class Miner {
  constructor() {
    this.receiverAddress = null;
    this.mining = false;

    // this.pendingTransactions = Transaction.pendingList;
  }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.mining = true;

    const chain = await Chain.load();

    let block = new Block();
    block.addCoinbase(this.receiverAddress);

    while (this.mining) {
      if (Transaction.pendingList.length > 0) {
        // Add transaction to block
        block.addTransaction(Transaction.pendingList.pop());
        console.log('Added pending transaction');
      }

      block.header.setDifficulty(chain.getCurrentDifficulty());
      block.header.incrementNonce();
      await block.header.computeHash();

      if (block.verifyHash()) {
        console.log(`New block: ${block.getTransactionCount()}`);
        await Block.save(block);
        chain.addBlockHeader(block.getHeader());

        // New block
        block = new Block();
        block.addCoinbase(this.receiverAddress);
      }

      await Chain.save(chain);
    }

    return true;
  }

  isMining() {
    return this.mining;
  }

  stop() {
    this.mining = false;
  }

  getReceiverAddress() {
    return this.receiverAddress;
  }

  setReceiverAddress(address) {
    this.receiverAddress = address;
  }
}

module.exports = Miner;
