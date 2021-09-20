// const bs58 = require('bs58');
const Chain = require('../models/chain');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');

const actions = {};

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
