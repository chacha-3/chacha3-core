// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Chain = require('../models/chain');
const Miner = require('../models/miner');

const actions = {};

const miner = new Miner();

actions.chainInfo = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  //   required: ['address'],
  // },
  handler: async () => {
    const chain = await Chain.load();
    const data = {
      length: chain.getLength(),
      currentDifficulty: chain.getCurrentDifficulty(),
      totalWork: chain.getTotalWork(),
    };

    return { data, code: 'ok', message: 'Chain info' };
  },
};

actions.destroyChain = {
  permission: 'authOnly',
  handler: async () => {
    await Chain.clear()
    const data = {};

    return { data, code: 'ok', message: 'Delete all blocks' };
  },
};

module.exports = actions;
