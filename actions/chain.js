// const bs58 = require('bs58');
// const { option } = require('yargs');

const Wallet = require('../models/wallet');
const Chain = require('../models/chain');
const Miner = require('../models/miner');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');

const actions = {};

const miner = new Miner();

actions.chainInfo = {
  permission: 'public',
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  //   required: ['address'],
  // },
  handler: async () => {
    const chain = Chain.mainChain;

    const data = {
      length: chain.getLength(),
      currentDifficulty: chain.getCurrentDifficulty(),
      totalWork: chain.getTotalWork(),
    };

    return okResponse(data, 'Chain Info');
  },
};

actions.pullChain = {
  permission: 'public',
  handler: async () => {
    const chain = Chain.mainChain;

    // const chain = chain.getBlockHeaders();
    return okResponse(chain.toObject(), 'Chain data');
  },
};

actions.destroyChain = {
  permission: 'authOnly',
  handler: async () => {
    await Chain.clear();
    return okResponse(null, 'Delete all blocks');
  },
};

// TODO: Move to relevant model
actions.accountBalance = {
  permission: 'public',
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
  handler: async (options) => {
    const chain = Chain.mainChain;

    const data = {
      balance: chain.getAccountBalance(options.address),
    };

    return okResponse(data, 'Account balance');
  },
};

module.exports = actions;
