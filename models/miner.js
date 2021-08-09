const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

// const db = level('wallets');
const Block = require('./block');
const Chain = require('./chain');

// const addressPrefix = '420_';

class Miner {
  constructor() {
    this.receiverAddress = null;
    this.mining = false;
  }

  async start() {
    assert(this.receiverAddress !== null);
    if (this.mining) {
      return;
    }

    this.mining = true;

    // TODO: Remove
    // await Chain.clear();

    const chain = await Chain.load();
    // console.log(`Miner started. Current height: ${chain.getLength()}. Current total work: ${chain.getTotalWork()}`);

    while (this.mining) {
      const block = new Block();
      block.addCoinbase(this.receiverAddress);
      const mineTime = await block.mine(chain.getCurrentDifficulty());

      // console.log(`New block mined ${block.getHeader().getHash().toString('hex')}. Time: ${mineTime}. Nonce: ${block.getHeader().getNonce()}, Difficulty: ${chain.getCurrentDifficulty()}`);

      Block.save(block);
      chain.addBlockHeader(block.getHeader());

      // console.log(`New block saved. Current height: ${chain.getLength()}. Current total work: ${chain.getTotalWork()}`);
      Chain.save(chain);
    }
  }

  isMining() {
    return this.mining;
  }

  stop() {
    this.mining = false;
  }

  setReceiverAddress(address) {
    this.receiverAddress = address;
  }
}

module.exports = Miner;
