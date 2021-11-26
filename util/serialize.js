const assert = require('assert');

const isBufferString = (value) => {
  if (!value) {
    return false;
  }

  if (typeof (value) !== 'string' || value.length < 2) {
    return false;
  }

  if (value.substr(0, 2) !== '0x') {
    return false;
  }

  return true;
};

const serializeBuffer = (value) => {
  if (!Buffer.isBuffer(value)) {
    return value;
  }

  return `0x${value.toString('hex')}`;
};

const deserializeBuffer = (value) => {
  if (!isBufferString(value)) {
    return value;
  }

  assert(value.length >= 2);

  return Buffer.from(value.substr(2), 'hex');
};

// Numbers proceeded by n (e.g. "10000n")
const isBigIntString = (value) => /^\d+n$/.test(value);

const serializeBigInt = (value) => `${value.toString()}n`;
const deserializeBigInt = (value) => BigInt(value.substr(0, value.length - 1));

const serializeObject = (obj) => {
  const serialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    // assert(Buffer.isBuffer(obj[key]));
    const value = obj[key];

    if (value === undefined || value === null) {
      return;
    }

    if (Buffer.isBuffer(value)) { // FIXME: Double check
      serialized[key] = serializeBuffer(value);
    } else if (typeof (value) === 'bigint') {
      serialized[key] = serializeBigInt(value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => serializeObject(v));
    } else if (value.toString() === '[object Object]') { // Is a sub-object
      serialized[key] = serializeObject(value);
    }
  });

  return serialized;
};

module.exports = {
  isBufferString,
  isBigIntString,
  serializeBuffer,
  deserializeBuffer,
  serializeBigInt,
  deserializeBigInt,
  serializeObject,
};
