const Ajv = require('ajv');
const PasswordValidator = require('password-validator');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server
const passwordSchema = new PasswordValidator();

const wallet = require('./wallet');
const transaction = require('./transaction');
const miner = require('./miner');
const chain = require('./chain');
const info = require('./info');
const peer = require('./peer');
const block = require('./block');

const { SuccessCode, ErrorCode, errorResponse } = require('../util/rpc');
const { serializeObject, deserializeBuffer } = require('../util/serialize');

/* eslint-disable newline-per-chained-call */
passwordSchema
  .is().min(8)
  .has().uppercase()
  .has().lowercase()
  .has().digits(1);

ajv.addKeyword('buffer', {
  compile(schema) {
    return (value, obj) => {
      if (schema === 'hex') {
        // eslint-disable-next-line no-param-reassign
        obj.parentData[obj.parentDataProperty] = deserializeBuffer(value);
      }
      // TODO: Base58

      return true;
    };
  },
});

ajv.addKeyword('validator', {
  validate: function validate(schema, data) {
    let valid = true;

    if (schema === 'passwordStrength' && !passwordSchema.validate(data)) {
      valid = false;
      validate.errors = [
        {
          keyword: 'passwordStrength',
          message: 'Password should have at least 8 characters, one uppercase, one lowercase and 1 digit',
          params: {
            keyword: 'passwordStrength',
          },
        }];
    }

    return valid;
  },
  errors: true,
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
    const promptFields = ['password', 'currentPassword', 'newPassword'];

    const requiredPassFields = (schema.required)
      ? promptFields.filter((field) => schema.required.includes(field))
      : [];

    const missingPassFields = requiredPassFields.filter(
      (field) => !Object.prototype.hasOwnProperty.call(options, field),
    );

    if (missingPassFields.length > 0) {
      const pluralize = missingPassFields.length > 1 ? 's' : '';

      return errorResponse(
        ErrorCode.InvalidArgument,
        `Password field${pluralize} required`,
        null,
        missingPassFields.join('|'),
      );
    }

    const validate = ajv.compile(schema);
    const valid = validate(options);

    if (!valid) {
      return errorResponse(
        ErrorCode.InvalidArgument,
        'Invalid argument',
        [validate.errors[0].message],
      );
    }
  }
  const result = await execute(options, handler);
  return serializeObject(result);
};

module.exports = {
  checkPermission,
  runAction,
  actionList,
};
