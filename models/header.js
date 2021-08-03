const crypto = require('crypto');
const { argon2d } = require('argon2-ffi');

const BN = require('bn.js');
const assert = require('assert');
const { BlockDB, HeaderDB, runningManualTest } = require('../util/db');

// TODO: Cleaner way for this. Add generic environment check

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

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

    this.time = Date.now();

    this.difficulty = 1;
    this.nonce = 0;

    this.hash = null;
  }

  static get MinTarget() {
    const env = process.env.NODE_ENV || 'development';
    return minTarget[env];
  }

  static async save(header) {
    assert(header.checksum != null);
    assert(header.hash != null);

    const data = {
      version: header.getVersion(),
      previous: (header.getPrevious() != null) ? header.getPrevious().toString('hex') : null,
      time: header.getTime(),
      difficulty: header.getDifficulty(),
      nonce: header.getNonce(),
      checksum: header.getChecksum().toString('hex'),
    };

    const key = header.getHash();
    await HeaderDB.put(`${header.getHash()}`, data, { valueEncoding: 'json' });

    return { key, data };
  }

  static async load(hash) {
    let data;

    try {
      data = await HeaderDB.get(`${hash}`, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const header = new Header();

    header.setVersion(data.version);
    header.setPrevious((data.previous) ? Buffer.from(data.previous, 'hex') : null);
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setNonce(data.nonce);
    header.setChecksum(Buffer.from(data.checksum, 'hex'));

    return header;
  }

  static async clearAll() {
    await HeaderDB.clear();
  }

  hashData() {
    assert(this.checksum !== null && this.time != null);

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

  async computeHash() {
    const options = {
      timeCost: 4,
      memoryCost: 16384,
      parallelism: 8,
      hashLength: 32,
    };

    const salt = Buffer.from(new Array(32).fill(0x00));

    const hashResult = await argon2d.hashRaw(this.hashData(), salt, options);
    // return hashResult;
    this.hash = new Array(32);

    for (let i = 0; i < 32; i += 1) {
      this.hash[i] = hashResult[i];
    }

    // if (hashResult[0] === 0) {
    //   console.log(this.nonce, this.hash);
    // }
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
    const target = new BN(Header.MinTarget, 16);

    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(this.difficulty, 0);

    const difficulty = new BN(buf.toString('hex'), 16);
    return target.div(difficulty).toString(16, 32);
  }

  getNonce() {
    return this.nonce;
  }

  setNonce(nonce) {
    this.nonce = nonce;
  }

  incrementNonce() {
    this.nonce += 1;
  }

  // async save() {
  //   const data = {
  //     version: this.version,
  //     previous: this.previous ? this.previous.toString('hex') : null,
  //     time: this.time,
  //     difficulty: this.difficulty,
  //     nonce: this.nonce,
  //     checksum: this.checksum.toString('hex'),
  //   };

  //   await HeaderDB.put(`${this.getHash()}`, data, { valueEncoding: 'json' });
  // }

  // async load(hash) {
  //   let data;

  //   try {
  //     data = await HeaderDB.get(`${hash}`, { valueEncoding: 'json' });
  //   } catch (e) {
  //     return false;
  //   }

  //   this.version = data.version;
  //   this.previous = Buffer.from(data.previous, 'hex');
  //   this.time = data.time;
  //   this.difficulty = data.difficulty;
  //   this.nonce = data.nonce;
  //   this.checksum = Buffer.from(data.checksum, 'hex');

  //   return true;
  // }

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
