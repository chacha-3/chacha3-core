const assert = require('assert');

const serializeBuffers = (obj, keys) => {
  assert(keys.length > 0);

  const serialized = { ...obj };

  keys.forEach((key) => {
    if (!serialized[key]) {
      return;
    }

    assert(Buffer.isBuffer(obj[key]));
    serialized[key] = serialized[key].toString('hex');
  });

  return serialized;
};

const deserializeBuffers = (obj, keys) => {
  assert(keys.length > 0);

  const deserialized = { ...obj };

  keys.forEach((key) => {
    if (!deserialized[key]) {
      return;
    }

    deserialized[key] = Buffer.from(deserialized[key], 'hex');
  });

  return deserialized;
};

module.exports = {
  serializeBuffers, deserializeBuffers,
};
