const Ajv = require('ajv');
const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

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

const routeAction = async (options) => {
  const actionName = options.action;
  const action = actions[actionName];

  if (!action) {
    return { code: 'unimplemented', message: 'Action not available' };
  }

  const { schema, handler } = action;

  if (schema) {
    const validate = ajv.compile(schema);

    if (!validate(options)) {
      return { errors: [validate.errors[0].message], code: 'invalid_argument', message: 'Invalid argument' };
    }
  }

  const {
    data, code, errors, message,
  } = await handler(options);

  if (code !== 'ok') {
    return { errors, code, message };
  }

  return { data, code, message };
};

module.exports = {
  // actionPermission,
  routeAction,
};
