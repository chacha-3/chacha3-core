const wallet = require('./wallet');
const transaction = require('./transaction');
const miner = require('./miner');
const chain = require('./chain');

const actions = {
  ...wallet,
  ...transaction,
  ...miner,
  ...chain,
};

actions.handshake = {
  permission: 'public',
  handler: async (requestData) => {
    const { version } = requestData;

    const data = {
      accepted: version >= 1,
      version: 1,
    };

    return { data, code: 'ok' };
  },
};

module.exports = actions;
