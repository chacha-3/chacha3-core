const debug = require('debug')('miner:model');
const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

const { serializeObject, deserializeObject, serializeBuffer } = require('../util/serialize');

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

    this.transactionInterval = null;
    this.pendingTransactions = [];
  }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.startTransactionPoll();

    this.mining = true;

    let block = new Block();
    block.addCoinbase(this.receiverAddress);

    while (this.mining) {
      const chain = Chain.mainChain;

      if (Chain.isSynching()) {
        debug('Mining paused. Chain out of sync');
        await waitUntil(() => !Chain.isSynching());
      }

      // const pendingList = await Transaction.loadPending();

      const rejected = block.addPendingTransactions(this.pendingTransactions);

      block.header.setDifficulty(Chain.mainChain.getCurrentDifficulty());
      block.header.incrementNonce();

      const latestBlock = chain.latestBlockHeader();
      block.setPreviousHash(latestBlock.getHash());

      block.header.computeHash();

      const verifiedTransaction = await block.verifyTransactions();
      if (block.verifyHash()) {
        debug(`Transaction verified: ${verifiedTransaction}, count: ${block.getTransactionCount()}`);
        if (verifiedTransaction) {
          debug(`Found new block. ${serializeBuffer(block.header.getPrevious())} <- ${serializeBuffer(block.header.getHash())}`);

          const result = await Chain.mainChain.confirmNewBlock(block);
          assert(result === true);

          if (result) {
            debug(`Confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
          } else {
            debug(`Reject confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
          }
          Peer.broadcastAction('pushBlock', block.toObject());

          // await Transaction.clearAllPending();

          // FIXME: Check added to block before removing

          // Clear pending transactions
          this.pendingTransactions = [];

          // Init new block for mining
          block = new Block();
          block.addCoinbase(this.receiverAddress);
        } else {
          debug(`Reject block ${serializeBuffer(block.header.getHash())}: ${verifiedTransaction}`);
          for (let x = 0; x < block.getTransactionCount(); x += 1) {
            const transaction = block.getTransaction(x);
            debug(`Transaction ${transaction.getId()} is previously saved: ${await transaction.isSaved()}`);
          }
        }
      }
    }

    return true;
  }

  startTransactionPoll() {
    debug('Call start poll');

    this.transactionInterval = setInterval(async () => {
      // TODO: Method to get active peers
      const peers = await Peer.all();
      const activePeers = peers.filter((peer) => peer.getStatus() === Peer.Status.Active);

      debug('Run poll function');
      for (let i = 0; i < activePeers.length; i += 1) {
        const peer = activePeers[i];
        debug('Get pending transactions from peer');
        peer.callAction('pendingTransactions', {}).then(async (response) => {
          if (!response) {
            // TODO: Check why has null response
            return;
          }

          const { data } = response;

          if (!data) {
            return;
          }

          await Transaction.savePendingTransactions(data);
        });
      }

      this.pendingTransactions = await Transaction.loadPending();
      debug(`Update pending transactions: ${this.pendingTransactions.length}`);
    }, 2000);
  }

  stopTransactionPoll() {
    clearInterval(this.transactionInterval);
  }

  isMining() {
    return this.mining;
  }

  stop() {
    this.stopTransactionPoll();
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
