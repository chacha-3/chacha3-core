/* eslint-disable no-underscore-dangle */
const assert = require('assert');
const BSON = require('bson');

const { Long, Decimal128, Int32 } = BSON;

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
    const value = obj[key];

    if (value === undefined || value === null) {
      return;
    }

    if (Buffer.isBuffer(value)) {
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

const packBigInt = (bigint) => {
  assert(bigint >= 0);

  const max = BigInt('0xffffffffffffffffffffffffffffffff');
  assert(bigint <= max);

  const padded = bigint.toString(16).padStart(32, '0');
  return Decimal128(Buffer.from(padded, 'hex'));
};

const unpackBigInt = (decimal128) => BigInt(`0x${decimal128.bytes.toString('hex')}`);

const unpackBuffer = (bytes) => Buffer.from(bytes.toString());

const packObject = (obj) => {
  const doc = { ...obj };

  // Add pack version, as pack method may be updated with improved compression
  doc._v = Int32(1);

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    if (value === undefined || value === null) {
      return;
    }
    if (typeof (value) === 'number') {
      doc[key] = Long.fromNumber(value);
    } else if (typeof (value) === 'bigint') {
      doc[key] = packBigInt(value);
    } else if (Array.isArray(value)) {
      // value.forEach((v) => packObject(v));
      assert(false); // No sub-array support
    } else if (value.toString() === '[object Object]') { // Is a sub-object
      // doc[key] = packObject(value);
      assert(false); // No sub-array support
    }
  });

  return BSON.serialize(doc);
};

const unpackObject = (data, bigIntFields = []) => {
  const obj = BSON.deserialize(data, { promoteBuffers: true, promoteLongs: true });

  // Custom BigInt de-serialization
  // As library does not have option to promote BigInt from Decimal128
  for (let i = 0; i < bigIntFields.length; i += 1) {
    const key = bigIntFields[i];

    if (obj[key]) {
      obj[key] = BigInt(`0x${obj[key].bytes.toString('hex')}`);
    }
  }

  return obj;
};

module.exports = {
  isBufferString,
  isBigIntString,
  serializeBuffer,
  deserializeBuffer,
  serializeBigInt,
  deserializeBigInt,
  serializeObject,
  packBigInt,
  unpackBigInt,
  unpackBuffer,
  packObject,
  unpackObject,
};
