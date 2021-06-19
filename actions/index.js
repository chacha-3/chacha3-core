const wallet = require('./wallet');

const actions = {
  ...wallet,
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
