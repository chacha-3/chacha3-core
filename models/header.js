const BN = require('bn.js');
const assert = require('assert');
const { argon2d } = require('argon2-ffi');

const { HeaderDB, runningManualTest } = require('../util/db');
const { serializeBuffers, deserializeBuffers, deserializeBuffer} = require('../util/serialize');

// TODO: Cleaner way for this. Add generic environment check

if (runningManualTest(process.argv)) {
  process.env.NODE_ENV = 'test';
}

const minTarget = {
  production: '0000ff0000000000000000000000000000000000000000000000000000000000',
  development: '00ff000000000000000000000000000000000000000000000000000000000000',
  test: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000',
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

  static fromSaveData(data, hash) {
    const header = new Header();

    header.setVersion(data.version);
    header.setPrevious((data.previous) ? Buffer.from(data.previous, 'hex') : null);
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setNonce(data.nonce);
    header.setChecksum(Buffer.from(data.checksum, 'hex'));
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

  static async clearAll() {
    await HeaderDB.clear();
  }

  hashData() {
    assert(this.checksum !== null && this.time != null);
    assert(this.previous !== null && this.previous.length === 32);

    const data = {
      version: this.version,
      previous: this.previous.toString('hex'),
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
      timeCost: 1,
      memoryCost: 1024,
      parallelism: 2,
      hashLength: 32,
    };

    const salt = Buffer.from(new Array(32).fill(0x00));

    const hashResult = await argon2d.hashRaw(this.hashData(), salt, options);
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
    assert(nonce > 0);

    this.nonce = nonce;
  }

  incrementNonce() {
    this.nonce = (this.nonce < Number.MAX_SAFE_INTEGER) ? this.nonce + 1 : 0;
  }

  static toPushData(header) {
    const data = {
      version: header.getVersion(),
      previous: header.getPrevious(),
      time: header.getTime(),
      difficulty: header.getDifficulty(),
      nonce: header.getNonce(),
      checksum: header.getChecksum(),
    };

    return serializeBuffers(data, ['previous', 'checksum']);
  }

  static fromPushData(obj) {
    const data = deserializeBuffers(obj, ['previous', 'checksum']);
    const header = new Header();

    header.setVersion(data.version);
    header.setPrevious(deserializeBuffer(data.previous));
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setNonce(data.nonce);
    header.setChecksum(deserializeBuffer(data.checksum));

    return header;
  }
}

module.exports = Header;
