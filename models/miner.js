const debug = require('debug')('miner:model');
const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

// const addressPrefix = '420_';

const waitUntil = (condition) => new Promise((resolve) => {
  const interval = setInterval(() => {
    if (!condition()) {
      return;
    }

    clearInterval(interval);
    resolve();
  }, 100);
});

class Miner {
  constructor() {
    this.receiverAddress = null;
    this.mining = false;
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

      if (Chain.isSynching()) {
        debug('Mining paused. Chain out of sync');
        await waitUntil(() => !Chain.isSynching());
      }

      const pendingList = await Transaction.loadPending();

      for (let i = 0; i < pendingList.length; i += 1) {
        block.addTransaction(pendingList[i]);
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
        debug(`Mined block #${Chain.mainChain.getLength()}`);
        debug(`Block length: ${Chain.mainChain.getLength()}`);

        Peer.broadcastAction('pushBlock', block.toObject());


        // FIXME: Check added to block before removing
        await Transaction.clearAllPending();

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
