const debug = require('debug')('miner:model');
const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

const { serializeBuffers, deserializeBuffers } = require('../util/serialize');

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

      for (let i = 0; i < this.pendingTransactions.length; i += 1) {
        block.addTransaction(this.pendingTransactions[i]);
      }

      block.header.setDifficulty(Chain.mainChain.getCurrentDifficulty());
      block.header.incrementNonce();

      const latestBlock = chain.latestBlockHeader();
      block.setPreviousHash(latestBlock.getHash());

      await block.header.computeHash();

      const verifiedTransaction = await block.verifyTransactions();
      if (block.verifyHash() && verifiedTransaction) {
        debug(`Found new block. ${block.header.getPrevious().toString('hex')} <- ${block.header.getHash().toString('hex')}`);
        await Block.save(block);

        chain.addBlockHeader(block.getHeader());
        await Chain.save(chain);
        debug(`Mined block #${Chain.mainChain.getLength()} (${block.getTransactionCount()} transactions)`);
        // debug(`Block length: ${Chain.mainChain.getLength()}`);

        await Transaction.clearAllPending();
        Peer.broadcastAction('pushBlock', block.toObject());

        // FIXME: Check added to block before removing

        // Init new block for mining
        block = new Block();
        block.addCoinbase(this.receiverAddress);
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
          const { data } = response;

          for (let j = 0; j < data.length; j += 1) {
            // TODO: Use from object
            const loaded = deserializeBuffers(data[j], ['id', 'sender', 'signature']);

            const transaction = new Transaction(
              // Not matching toObject key 'sender' instead of senderKey. To fix name?
              loaded.sender,
              loaded.receiver,
              loaded.amount,
            );

            transaction.setVersion(loaded.version);
            transaction.setSignature(loaded.signature);
            transaction.setTime(loaded.time);

            // console.log(transaction.getId());
            const saved = await Transaction.save(transaction, true);
            if (saved == null) {
              debug(`Did not save pending transaction: ${transaction.getId().toString('hex')}`);
            } else {
              debug(`Save pending transaction: ${transaction.getId().toString('hex')}`);
            }
          }
        });
      }

      this.pendingTransactions = await Transaction.loadPending();
    }, 1000);
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
