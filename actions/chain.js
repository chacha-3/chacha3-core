// const bs58 = require('bs58');
// const { option } = require('yargs');

const Wallet = require('../models/wallet');
const Chain = require('../models/chain');
const Miner = require('../models/miner');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
const { serializeBuffer } = require('../util/serialize');

const actions = {};

const miner = new Miner();

actions.chainInfo = {
  permission: 'public',
  handler: async () => {
    const chain = Chain.mainChain;

    const data = {
      length: chain.getLength(),
      currentDifficulty: chain.getCurrentDifficulty(),
      totalWork: chain.getTotalWork(),
      synching: Chain.isSynching(),
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
