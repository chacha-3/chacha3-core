const assert = require('assert');

const serializeBuffer = (buffer) => {
  assert(Buffer.isBuffer(buffer));
  if (buffer === null) {
    return null;
  }

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
