const assert = require('assert');
const crypto = require('crypto');

const { HeaderDB, runningManualTest } = require('../util/db');
const { serializeObject, deserializeObject, deserializeBuffer, serializeBuffer } = require('../util/serialize');

// TODO: Cleaner way for this. Add generic environment check

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

const minTarget = {
  production: '0x0000ff0000000000000000000000000000000000000000000000000000000000',
  development: '0x0000ff0000000000000000000000000000000000000000000000000000000000',
  test: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000',
};

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
    const env = process.env.NODE_ENV || 'development';
    return minTarget[env];
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

    const key = this.getHash();
    await HeaderDB.put(`${this.getHash()}`, serializeObject(data), { valueEncoding: 'json' });
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
      data = await HeaderDB.get(`${hash}`, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    return Header.fromSaveData(data, hash);
  }

  static async clear(hash) {
    await HeaderDB.del(hash);
  }

  hashData() {
    assert(this.checksum !== null && this.time != null);
    assert(this.previous !== null && this.previous.length === 32);

    const data = {
      version: this.version,
      previous: this.previous,
      time: this.time,
      difficulty: this.difficulty,
      nonce: this.nonce,
      checksum: this.getChecksum,
    };


    return JSON.stringify(data);
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
    const hashResult = crypto.createHash('sha3-256').update(this.hashData(), 'utf-8').digest();
    this.hash = hashResult;
  }

  getHash() {
    assert(this.hash != null);
    return this.hash;
    // const pass1 = crypto.createHash('sha256').update(Buffer.from(this.hashData())).digest();
    // const pass2 = crypto.createHash('sha256').update(pass1).digest();

    // return pass2;
  }

  setHash(hash) {
    this.hash = hash;
  }

  getTarget() {
    const target = BigInt(serializeBuffer(Header.MinTarget));
    const difficulty = BigInt(Math.round(this.difficulty));

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
    this.nonce = (this.nonce < Number.MAX_SAFE_INTEGER) ? this.nonce + 1 : 0;
  }

  static fromObject(obj) {
    const data = deserializeObject(obj);

    const header = new Header();

    header.setHash(data.hash);
    header.setPrevious(data.previous);
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setNonce(data.nonce);
    header.setChecksum(data.checksum);
    header.setVersion(data.version);

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
    return JSON.stringify(this.toObject()) === JSON.stringify(header.toObject());
  }
}

module.exports = Header;
