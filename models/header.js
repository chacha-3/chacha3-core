const assert = require('assert');
const crypto = require('crypto');
const blake3 = require('blake3-wasm');

const { HeaderDB } = require('../util/db');
const { serializeObject, deserializeBuffer, serializeBuffer } = require('../util/serialize');

const { config, Env } = require('../util/env');
const { Production, Development, Testing } = Env;

// TODO: Cleaner way for this. Add generic environment check

const minTarget = {
  [Production]: '0x0000ff0000000000000000000000000000000000000000000000000000000000',
  [Development]: '0x000007f800000000000000000000000000000000000000000000000000000000',
  [Testing]: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000',
};

// 0000ff0000000000000000000000000000000000000000000000000000000000
// 000007f800000000000000000000000000000000000000000000000000000000

class Header {
  constructor() {
    this.version = 1;

    this.previous = null;
    this.checksum = null; // TODO:

    this.time = Date.now();

    this.difficulty = 1.0;
    this.nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER + 1);

    this.hash = null;
  }

  static get MinTarget() {
    const { environment } = config;
    return minTarget[environment];
  }

  async save() {
    assert(this.checksum != null);
    assert(this.hash != null);

    const data = {
      version: this.getVersion(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      nonce: this.getNonce(),
      checksum: this.getChecksum(),
    };

    await HeaderDB.put(this.getHash(), serializeObject(data), { valueEncoding: 'json' });
  }

  static fromSaveData(data, hash) {
    const header = new Header();

    header.setVersion(data.version);
    header.setPrevious(deserializeBuffer(data.previous));
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setNonce(data.nonce);
    header.setChecksum(deserializeBuffer(data.checksum));
    header.setHash(hash);

    return header;
  }

  static async load(hash) {
    let data;

    try {
      data = await HeaderDB.get(hash, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    return Header.fromSaveData(data, hash);
  }

  static async clear(hash) {
    return HeaderDB.del(hash);
  }

  hashData() {
    assert(this.checksum !== null && this.time != null);

    const data = {
      version: this.getVersion(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      nonce: this.getNonce(),
      checksum: this.getChecksum(),
    };

    return JSON.stringify(serializeObject(data));
  }

  getVersion() {
    return this.version;
  }

  setVersion(version) {
    this.version = version;
  }

  getPrevious() {
    return this.previous;
  }

  setPrevious(previous) {
    this.previous = previous;
  }

  getTime() {
    return this.time;
  }

  setTime(time) {
    this.time = time;
  }

  getDifficulty() {
    return this.difficulty;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
  }

  getChecksum() {
    return this.checksum;
  }

  setChecksum(checksum) {
    this.checksum = checksum;
  }

  computeHash() {
    const hashResult = blake3.hash(this.hashData());
    assert(hashResult.length === 32);

    // this.hash = hashResult;
    return hashResult;
  }

  getHash() {
    assert(this.hash != null);
    return this.hash;
  }

  setHash(hash) {
    this.hash = hash;
  }

  getTarget() {
    const target = BigInt(Header.MinTarget);
    const difficulty = BigInt(Math.round(this.difficulty));

    if (difficulty === 0n) {
      return target;
    }

    return target / difficulty;
  }

  getNonce() {
    return this.nonce;
  }

  setNonce(nonce) {
    assert(nonce > 0);

    this.nonce = nonce;
  }

  incrementNonce() {
    this.nonce += 1;
  }

  verifyHash(recalculate = true) {
    assert(this.getHash() !== null);
    assert(this.getNonce() > 0);

    if (recalculate && !this.getHash().equals(this.computeHash())) {
      return false;
    }

    const hashNum = BigInt(serializeBuffer(this.getHash()));
    return hashNum < this.getTarget();
  }

  static fromObject(obj) {
    const header = new Header();

    header.setHash(deserializeBuffer(obj.hash));
    header.setPrevious(deserializeBuffer(obj.previous));
    header.setTime(obj.time);
    header.setDifficulty(obj.difficulty);
    header.setNonce(obj.nonce);
    header.setChecksum(deserializeBuffer(obj.checksum));
    header.setVersion(obj.version);

    return header;
  }

  toObject() {
    const data = {
      hash: this.getHash(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      nonce: this.getNonce(),
      checksum: this.getChecksum(),
      version: this.getVersion(),
    };

    return serializeObject(data);
  }

  equals(header) {
    // TODO: Check selected keys only
    return JSON.stringify(this.toObject()) === JSON.stringify(header.toObject());
  }
}

module.exports = Header;
