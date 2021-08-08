// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Chain = require('../models/chain');
const Miner = require('../models/miner');

const actions = {};

const miner = new Miner();

actions.startMiner = {
  permission: 'public', // TODO: Change to private
  schema: {
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
  handler: (options) => {
    miner.setReceiverAddress(options.address);
    miner.start();

    const data = {
      address: options.address,
    };

    return { data, code: 'ok', message: 'Running miner' };
  },
};

actions.stopMiner = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  // },
  handler: async (options) => {
    miner.stop();

    const data = {
      // address: options.address,
    };

    return { data, code: 'ok', message: 'Stopped miner' };
  },
};

module.exports = actions;
