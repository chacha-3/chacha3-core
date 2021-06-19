const wallet = require('./wallet');

const actions = {
  ...wallet,
};

actions.handshake = {
  permission: 'public',
  handler: async (request, reply) => {
    const { version } = request.body;

    const data = {
      accepted: version >= 1,
      version: 1,
    };

    reply.send({ data });
  },
};

module.exports = actions;
