const wallet = require('./wallet');

const actions = {
  ...wallet,
};

actions.handshake = async (request) => {
  const accepted = request.version >= 1;

  const data = {
    accepted,
    version: 1,
  };

  return { data };
};

module.exports = actions;
