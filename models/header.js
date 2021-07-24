const crypto = require('crypto');
const BN = require('bn.js');
const assert = require('assert');
const { BlockDB, HeaderDB } = require('../util/db');

const minTarget = {
  production: '0000ff0000000000000000000000000000000000000000000000000000000000',
  development: '0000ff0000000000000000000000000000000000000000000000000000000000',
  test: 'ffffffffffffffffffff00000000000000000000000000000000000000000000',
};

class Header {
  constructor() {
    this.version = 1;

    this.previous = null;
    this.checksum = null; // TODO:

    this.date = Date.now();

    this.difficulty = 1;
    this.nonce = 0;
  }

  static get MinTarget() {
    const env = process.env.NODE_ENV || 'development';
    return minTarget[env];
  }

  hashData() {
    assert(this.checksum !== null);

    const data = {
      version: this.version,
      previous: this.previous ? this.previous.toString('hex') : null,
      time: this.time,
      difficulty: this.difficulty,
      nonce: this.nonce,
      checksum: this.checksum.toString('hex'),
    };

    return JSON.stringify(data);
  }

  getChecksum() {
    return this.checksum;
  }

  setChecksum(checksum) {
    this.checksum = checksum;
  }

  getHash() {
    const pass1 = crypto.createHash('sha256').update(Buffer.from(this.hashData())).digest();
    const pass2 = crypto.createHash('sha256').update(pass1).digest();

    return pass2;
  }

  getDifficulty() {
    return this.difficulty;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
  }

  getTarget() {
    const target = new BN(Header.MinTarget, 16);

    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(this.difficulty, 0);

    const difficulty = new BN(buf.toString('hex'), 16);
    return target.div(difficulty).toString(16, 32);
  }

  getNonce() {
    return this.nonce;
  }

  incrementNonce() {
    this.nonce += 1;
  }

  async save() {
    const data = {
      version: this.version,
      previous: this.previous ? this.previous.toString('hex') : null,
      time: this.time,
      difficulty: this.difficulty,
      nonce: this.nonce,
      checksum: this.checksum.toString('hex'),
    };

    await HeaderDB.put(`${this.getHash()}`, data, { valueEncoding: 'json' });
  }

  async load(hash) {
    let data;

    try {
      data = await HeaderDB.get(`${hash}`, { valueEncoding: 'json' });
    } catch (e) {
      return false;
    }

    this.version = data.version;
    this.previous = Buffer.from(data.previous, 'hex');
    this.time = data.time;
    this.difficulty = data.difficulty;
    this.nonce = data.nonce;
    this.checksum = Buffer.from(data.checksum, 'hex');

    return true;
  }

  toObject() {
    return {
      version: this.version,
      checksum: (this.checksum) ? this.checksum.toString('hex') : null,
      date: this.date,
      difficulty: this.difficulty,
      nonce: this.nonce,
    };
  }
}

module.exports = Header;
