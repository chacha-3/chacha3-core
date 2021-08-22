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

const serializeObject = (obj) => {
  const serialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    serialized[key] = serializeIfBuffer(obj[key]);
  });

  return JSON.stringify(serialized);
};

const deserializeObject = (data, exemptFields) => {
  const obj = JSON.parse(data);

  Object.keys(obj).forEach((key) => {
    if (exemptFields && exemptFields.includes(key)) {
      return;
    }

    obj[key] = deserializeIfHex(obj[key]);
  });

  return obj;
};

module.exports = {
  serializeBuffer, deserializeBuffer, serializeObject, deserializeObject,
};
