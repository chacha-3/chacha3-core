const Ajv = require('ajv');
const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const wallet = require('./wallet');
const transaction = require('./transaction');
const miner = require('./miner');
const chain = require('./chain');
const info = require('./info');
const peer = require('./peer');

const { option } = require('yargs');

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

// TODO: Implement actual auth check
const checkPermission = (action, permission) => {
  const permissionDefault = process.env.NODE_ENV === 'test' ? 'full' : 'none';
  const userPermission = permission || permissionDefault;

  const actionPermission = action.permission;

  if (actionPermission === 'public' || userPermission === 'full') {
    return true;
  }

  // if (actionPermission === 'authOnly') {
  //   return userPermission === 'auth';
  // }

  return false;
};

const runAction = async (options, permission) => {
  // if (options.action === 'teapot') {
  //   throw Error('Out of coffee');
  // }

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

  const {
    data, code, errors, message,
  } = await handler(options);

  if (code !== 'ok') {
    return { errors, code, message };
  }

  return { data, code, message };
};

module.exports = {
  runAction,
};
