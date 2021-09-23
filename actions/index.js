const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const wallet = require('./wallet');
const transaction = require('./transaction');
const miner = require('./miner');
const chain = require('./chain');
const info = require('./info');
const peer = require('./peer');
const block = require('./block');

const { SuccessCode, ErrorCode, errorResponse } = require('../util/rpc');
const { serializeObject, deserializeBuffer } = require('../util/serialize');

ajv.addKeyword('buffer', {
  compile(schema) {
    return (value, obj) => {
      if (schema === 'hex') {
        // eslint-disable-next-line no-param-reassign
        obj.parentData[obj.parentDataProperty] = deserializeBuffer(value);
      } else if (schema === 'base58') {
        // TODO:
      }

      return true;
    };
  },
});

const actions = {
  ...wallet,
  ...transaction,
  ...miner,
  ...chain,
  ...info,
  ...peer,
  ...block,
};

const actionList = Object.keys(actions);

const routeAction = (options) => {
  const actionName = options.action;
  return actions[actionName];
};

const execute = async (options, handler) => {
  const {
    data, code, errors, message,
  } = await handler(options);

  if (code !== SuccessCode) {
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
  if (!options || !options.action) {
    return errorResponse(ErrorCode.InvalidArgument, 'Action is missing');
  }

  const action = routeAction(options);

  if (!action) {
    return errorResponse(ErrorCode.Unimplemented, `Action '${options.action}' not available`);
  }

  if (!checkPermission(action, permission)) {
    return errorResponse(ErrorCode.Unauthenticated, 'Auth required');
  }

  if (action.preValidation) {
    await action.preValidation(options);
  }

  const { schema, handler } = action;

  if (schema) {
    const requiresPassword = schema.required && schema.required.includes('password');

    if (requiresPassword && !options.password) {
      return errorResponse(ErrorCode.InvalidArgument, 'Enter wallet passphrase', null, 'password');
    }

    const validate = ajv.compile(schema);

    if (!validate(options)) {
      return errorResponse(ErrorCode.InvalidArgument, 'Invalid argument', [validate.errors[0].message]);
    }
  }

  let result;
  try {
    // console.log(`options: ${JSON.stringify(options)}`);
    // result = await execute(deserializeObject(options), handler);
    result = await execute(options, handler);
  } catch (e) {
    result = { message: e.message, code: 'internal' };
  }

  return serializeObject(result);
};

module.exports = {
  checkPermission,
  runAction,
  actionList,
};
