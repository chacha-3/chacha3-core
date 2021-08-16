const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');

const { BlockDB, ChainDB } = require('../util/db');

// const addressPrefix = '420_';

class Miner {
  constructor() {
    this.receiverAddress = null;
    this.mining = false;

    // this.pendingTransactions = Transaction.pendingList;
  }

  // async mine(difficulty) {
  //   const start = performance.now();
  //   let found = false;

  //   this.header.setDifficulty(difficulty || 1);

  //   while (!found) {
  //     this.header.incrementNonce();

  //     // eslint-disable-next-line no-await-in-loop
  //     await this.header.computeHash();

  //     found = this.verifyHash();
  //   }

  //   const end = performance.now();

  //   return end - start;
  // }

  async start() {
    // await Block.clearAll();
    // await Chain.clear();

    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.mining = true;

    // TODO: Remove
    // await Chain.clear();

    const chain = await Chain.load();
    // console.log(chain);

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
