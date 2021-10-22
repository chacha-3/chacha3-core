const debug = require('debug')('miner:model');
const assert = require('assert');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

const { serializeBuffer } = require('../util/serialize');
const { waitUntil } = require('../util/sync');
// const addressPrefix = '420_';

class Miner {
  constructor() {
    this.receiverAddress = null;
    this.mining = false;

    this.transactionInterval = null;
    this.pendingTransactions = [];
  }

  async foundBlock(block) {
    debug(`Found new block. ${serializeBuffer(block.header.getPrevious())} <- ${serializeBuffer(block.header.getHash())}`);

    const result = await Chain.mainChain.confirmNewBlock(block);

    if (!result) {
      console.log(Chain.mainChain.getLength(), block);
    }
    assert(result === true);

    if (result) {
      debug(`Confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
      Peer.broadcastAction('pushBlock', block.toObject());

      // Clear pending transactions
      // TODO: Clear only transactions in block
      this.pendingTransactions = [];
    } else {
      debug(`Reject confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
    }

    // FIXME: Check added to block before removing
  }

  initMiningBlock() {
    const block = new Block();
    block.addCoinbase(this.receiverAddress, Chain.blockRewardAtIndex(Chain.mainChain.getLength()));

    return block;
  }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.startTransactionPoll();

    this.mining = true;

    let block = this.initMiningBlock();

    while (this.mining) {
      const chain = Chain.mainChain; // TODO: Move this to after synching

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

      const transactionsVerified = await block.verifyTransactions();
      if (block.verifyHash() && transactionsVerified) {
        await this.foundBlock(block);

        // Init new block for mining
        block = this.initMiningBlock();
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

          await Miner.savePendingTransactions(data);
        });
      }

      this.pendingTransactions = await Transaction.loadPending();
      debug(`Update pending transactions: ${this.pendingTransactions.length}`);
    }, 2000);
  }

  static async savePendingTransactions(dataArray) {
    const transactions = Transaction.fromArray(dataArray);

    transactions.forEach((transaction) => {
      transaction.saveAsPending().then((saved) => {
        if (saved === null) {
          debug(`Rejected pending pending transaction from poll: ${serializeBuffer(transaction.getId())}`);
        } else {
          debug(`Save pending transaction from poll: ${serializeBuffer(transaction.getId())}`);
        }
      });
    });
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
