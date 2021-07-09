const wallet = require('./wallet');
const transaction = require('./transaction');

const actions = {
  ...wallet,
  ...transaction,
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
