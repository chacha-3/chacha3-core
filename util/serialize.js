const assert = require('assert');

const serializeBuffer = (value) => {
  if (!Buffer.isBuffer(value)) {
    return value;
  }

  return `0x${value.toString('hex')}`;
};

const deserializeBuffer = (value) => {
  if (value.substr(0, 2) !== '0x') {
    return value;
  }

  return Buffer.from(value.substr(2), 'hex');
};

const serializeObject = (obj) => {
  const serialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    // assert(Buffer.isBuffer(obj[key]));

    if (Buffer.isBuffer(obj[key])) { // FIXME: Double check
      serialized[key] = serializeBuffer(obj[key]);
    } else if (typeof (obj[key]) === 'bigint') {
      serialized[key] = `${obj[key].toString()}n`;
    }
  });

  return serialized;
};

const deserializeObject = (obj) => {
  const deserialized = { ...obj };

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

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
