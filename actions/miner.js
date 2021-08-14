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
  preValidation: async (options) => {
    let selectedWallet;

    if (!options.address && (selectedWallet = await Wallet.getSelected())) {
      // eslint-disable-next-line no-param-reassign
      options.address = selectedWallet;
    }
  },
  handler: (options) => {
    if (miner.isMining()) {
      return { code: 'failed_precondition', message: 'Miner already running' };
    }

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

actions.minerStatus = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  // },
  handler: async (options) => {
    const data = {
      isMining: miner.isMining(),
    };

    if (miner.isMining()) {
      data.address = miner.getReceiverAddress();
    }

    return { data, code: 'ok', message: 'Miner status' };
  },
};

module.exports = actions;
