const debug = require('debug')('miner:model');
const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

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

    let block = new Block();
    block.addCoinbase(this.receiverAddress);

    while (this.mining) {
      const chain = Chain.mainChain;

      if (Chain.mainChain.isSynching()) {
        console.log('chain synching stop mining');
        continue;
      }

      if (Transaction.pendingList.length > 0) {
        // Add transaction to block
        block.addTransaction(Transaction.pendingList.pop());
      }

      block.header.setDifficulty(Chain.mainChain.getCurrentDifficulty());
      block.header.incrementNonce();

      const latestBlock = chain.latestBlockHeader();
      block.setPreviousHash(latestBlock.getHash());

      await block.header.computeHash();

      if (block.verifyHash()) {
        debug(`Found new block. ${block.header.getPrevious().toString('hex')} <- ${block.header.getHash().toString('hex')}`);
        await Block.save(block);

        chain.addBlockHeader(block.getHeader());
        await Chain.save(chain);

        Peer.broadcastAction('pushBlock', block.toObject());

        // Init new block for mining
        block = new Block();
        block.addCoinbase(this.receiverAddress);
      }
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
