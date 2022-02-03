const assert = require('assert');
const debug = require('debug')('miner:model');
const { Worker } = require('worker_threads');

const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

const { serializeBuffer } = require('../util/serialize');
const { waitUntil } = require('../util/sync');

class Miner {
  constructor() {
    this.worker = null;

    this.receiverAddress = null;
    this.mining = false;

    this.transactionInterval = null;
    this.pendingTransactions = [];
  }

  static async foundBlock(block) {
    debug(`Found new block. ${serializeBuffer(block.header.getPrevious())} <- ${serializeBuffer(block.header.getHash())}`);

    assert(block.header.getPrevious() !== null);

    const result = await Chain.mainChain.confirmNewBlock(block);

    // TODO: Add check. Should confirm successfully unless prev hash is different
    // assert(result === true);

    if (result) {
      await Chain.mainChain.save();
      debug(`Confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
      Peer.broadcastAction('pushBlock', block.toObject());
    } else {
      debug(`Reject confirmed new block: ${serializeBuffer(block.getHeader().getHash())}`);
    }

    // FIXME: Check added to block before removing
  }

  initMiningBlock() {
    const block = new Block();
    block.addCoinbase(this.receiverAddress, Chain.blockRewardAtIndex(Chain.mainChain.getLength()));
    block.header.setDifficulty(Chain.mainChain.getCurrentDifficulty());

    const latestBlock = Chain.mainChain.lastBlockHeader();
    block.setPreviousHash(latestBlock.getHash());

    const rejected = block.addPendingTransactions(this.pendingTransactions);
    // TODO: Clear rejected blocks

    block.header.hash = block.header.computeHash();

    return block;
  }

  miningWorker(header, timeout) {
    return new Promise((resolve, reject) => {
      this.worker = new Worker('./workers/miner.js', { workerData: { headerData: header.toObject(), timeout } });
      this.worker.on('message', (metaResult) => {
        resolve(metaResult);
      });
      this.worker.on('error', (error) => {
        // reject(error);
      });
      this.worker.on('exit', (code) => {
        resolve(null);
      });
    });
  }

  static async pauseIfChainSynching() {
    if (!Chain.mainChain.isSynching()) {
      return;
    }

    await waitUntil(() => !Chain.mainChain.isSynching());
  }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.startTransactionPoll();

    this.mining = true;

    while (this.mining) {
      await Miner.pauseIfChainSynching();

      const block = this.initMiningBlock();
      let foundMeta;

      try {
        foundMeta = await this.miningWorker(block.getHeader(), 10000);
      } catch (err) {
        foundMeta = null;
      }

      if (foundMeta !== null) {
        const {
          a, x, y, z,
        } = foundMeta;

        console.log(foundMeta)

        block.header.setMeta(a, x, y, z);
        block.header.hash = block.header.computeHash();

        await Miner.foundBlock(block);
      }
    }

    return true;
  }

  startTransactionPoll() {
    debug('Call start poll');

    this.transactionInterval = setInterval(async () => {
      const activePeers = await Peer.activeList();

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
    }, 10000);
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
    if (this.worker) {
      this.worker.terminate();
    }

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
