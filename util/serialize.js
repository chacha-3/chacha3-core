const assert = require('assert');

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

module.exports = {
  serializeBuffer, deserializeBuffer,
};
