const assert = require('assert');

const serializeBuffer = (value) => {
  if (!Buffer.isBuffer(value)) {
    return value;
  }

  return `0x${value.toString('hex')}`;
};

const deserializeBuffer = (value) => {
  if (!value) {
    return null;
  }

  assert(value.length >= 2);

  if (value.substr(0, 2) !== '0x') {
    return value;
  }

  return Buffer.from(value.substr(2), 'hex');
};

const serializeObject = (obj) => {
  const serialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    // assert(Buffer.isBuffer(obj[key]));
    const value = obj[key];

    if (!value) {
      return;
    }

    if (Buffer.isBuffer(value)) { // FIXME: Double check
      serialized[key] = serializeBuffer(value);
    } else if (typeof (value) === 'bigint') {
      serialized[key] = `${value.toString()}n`;
    } else if (Array.isArray(value)) {
      value.forEach((v) => serializeObject(v));
    } else if (value.toString() === '[object Object]') { // Is a sub-object
      serialized[key] = serializeObject(value);
    }
  });

  return serialized;
};

const deserializeObject = (obj) => {
  const deserialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((v) => deserializeObject(v));
    } else if (value.toString() === '[object Object]') {
      deserialized[key] = deserializeObject(obj[key]);
      return;
    }

    if (typeof value !== 'string') {
      return;
    }

    // Numbers proceeded by n (e.g. "10000n")
    const isBigIntString = /^\d+n$/.test(value);

    if (isBigIntString) {
      deserialized[key] = BigInt(value.substr(0, value.length - 1));
    } else if (value.substr(0, 2) === '0x') { // FIXME: Double check
      deserialized[key] = deserializeBuffer(value);
    }
  });

  return deserialized;
};

module.exports = {
  serializeObject,
  deserializeObject,
  serializeBuffer,
  deserializeBuffer,
};
