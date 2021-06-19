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

    return [data, 200];
  },
};

module.exports = actions;
