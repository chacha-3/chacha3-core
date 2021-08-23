const assert = require('assert');

function serializeIfBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input.toString('hex');
  }

  return input;
}

function deserializeIfHex(input) {
  if (typeof (input) !== 'string') {
    return input;
  }

  const buffer = Buffer.from(input, 'hex');

  if (buffer.length === input.length / 2) {
    return buffer;
  }

  return input;
}

const serializeBuffer = (buffer) => {
  if (buffer === null) {
    return null;
  }

  assert(Buffer.isBuffer(buffer));
  return buffer.toString('hex');
};

const deserializeBuffer = (hexString) => {
  if (hexString === null) {
    return null;
  }

  return Buffer.from(hexString, 'hex');
};

const serializeBuffers = (obj, keys) => {
  assert(keys.length > 0);

  const serialized = { ...obj };

  keys.forEach((key) => {
    if (!serialized[key]) {
      return;
    }

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
  serializeBuffers, deserializeBuffers, serializeBuffer, deserializeBuffer,
};
