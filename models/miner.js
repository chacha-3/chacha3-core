const assert = require('assert');
const debug = require('debug')('miner:model');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const Block = require('./block');
const Chain = require('./chain');
const Transaction = require('./transaction');
const Peer = require('./peer');

const { serializeBuffer } = require('../util/serialize');
const { waitUntil } = require('../util/sync');
// const addressPrefix = '420_';

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
    console.log('prev:', Chain.mainChain)

    const result = await Chain.mainChain.confirmNewBlock(block);
    assert(result === true);

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

    return block;
  }

  // static miningWorker(header, timeout) {
  //   return new Promise((resolve, reject) => {
  //     this.worker = new Worker('./workers/miner.js', { workerData: { headerData: header.toObject(), timeout } });
  //     this.worker.on('message', (nonce) => {
  //       console.log(`Receive nonce: ${nonce}`);
  //       resolve(nonce);
  //     });
  //     this.worker.on('error', (error) => {
  //       reject(error);
  //     });
  //     this.worker.on('exit', (code) => {
  //       // console.log('error code ' + code);
  //       // resolve(-1);

  //       if (code !== 1) {
  //         reject('exit code: ' + code);
  //       } else {
  //         resolve(-1);
  //       }
  //     });
  //   });
  // }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return false;
    }

    this.startTransactionPoll();

    this.mining = true;

    while (this.mining) {
      // const chain = Chain.mainChain; // TODO: Move this to after synching

      if (Chain.mainChain.isSynching()) {
        debug('Mining paused. Chain out of sync');
        await waitUntil(() => !Chain.isSynching());
      }

      // const pendingList = await Transaction.loadPending();
      const block = this.initMiningBlock();
      const rejected = block.addPendingTransactions(this.pendingTransactions);

      block.header.setDifficulty(Chain.mainChain.getCurrentDifficulty());

      const latestBlock = Chain.mainChain.lastBlockHeader();
      block.setPreviousHash(latestBlock.getHash());

      block.header.hash = block.header.computeHash();
      
      let foundNonce = -1;

      try {
        foundNonce = await new Promise((resolve, reject) => {
          this.worker = new Worker('./workers/miner.js', { workerData: { headerData: block.getHeader().toObject(), timeout: 10000 } });
          this.worker.on('message', (nonce) => {
            console.log(`Receive nonce: ${nonce}`);
            resolve(nonce);
          });
          this.worker.on('error', (error) => {
            // reject(error);
          });
          this.worker.on('exit', (code) => {
            resolve(-1);
          });
        });
      } catch (err) {
        console.log(err);
      }
     
      if (foundNonce > 0) {
        block.header.setNonce(foundNonce);
        block.header.hash = block.header.computeHash();

        await Miner.foundBlock(block);
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
    this.worker.terminate();
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
