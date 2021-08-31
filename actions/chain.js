// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
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

module.exports = actions;
