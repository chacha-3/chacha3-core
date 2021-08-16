const Ajv = require('ajv');
const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const wallet = require('./wallet');
const transaction = require('./transaction');
const miner = require('./miner');
const chain = require('./chain');
const info = require('./info');
const peer = require('./peer');

const actions = {
  ...wallet,
  ...transaction,
  ...miner,
  ...chain,
  ...info,
  ...peer,
};

const routeAction = (options) => {
  const actionName = options.action;
  return actions[actionName];
};

const execute = async (options, handler) => {
  const {
    data, code, errors, message,
  } = await handler(options);

  if (code !== 'ok') {
    return { errors, code, message };
  }

  return { data, code, message };
};

// TODO: Implement actual auth check
const checkPermission = (action, permission) => {
  const userPermission = permission || 'full';
  const actionPermission = action.permission;

  if (actionPermission === 'public' || userPermission === 'full') {
    return true;
  }

  return false;
};

const runAction = async (options, permission) => {
  const action = routeAction(options);

  if (!action) {
    return { code: 'unimplemented', message: 'Action not available' };
  }

  if (!checkPermission(action, permission)) {
    return { code: 'unauthenticated', message: 'Auth required' };
  }

  if (action.preValidation) {
    await action.preValidation(options);
  }

  const { schema, handler } = action;

  if (schema) {
    const validate = ajv.compile(schema);

    if (!validate(options)) {
      return { errors: [validate.errors[0].message], code: 'invalid_argument', message: 'Invalid argument' };
    }
  }

  let result;

  try {
    result = await execute(options, handler);
  } catch (e) {
    result = { message: e.message, code: 'internal' };
  }

  return result;
};

module.exports = {
  checkPermission,
  runAction,
};
