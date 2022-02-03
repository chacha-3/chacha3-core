const assert = require('assert');
const blake3 = require('blake3-wasm');

const { HeaderDB } = require('../util/db');

const {
  serializeObject, deserializeBuffer, serializeBuffer, packObject, unpackObject,
} = require('../util/serialize');

const { config, Env } = require('../util/env');
const { randomNumberBetween } = require('../util/math');

const { Production, Development, Testing } = Env;

// TODO: Cleaner way for this. Add generic environment check

const minTarget = {
  [Production]: '0x000007f800000000000000000000000000000000000000000000000000000000', // TODO: Set
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
    this.randomizeMeta();
    // this.a = 0;

    // this.x = 0;
    // this.y = 0;
    // this.z = 0;

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
      checksum: this.getChecksum(),
      a: this.getA(),
      x: this.getX(),
      y: this.getY(),
      z: this.getZ(),
      w: this.getW(),
    };

    await HeaderDB.put(this.getHash(), packObject(data), {
      keyEncoding: 'binary',
      valueEncoding: 'binary',
    });
  }

  static fromSaveData(data, hash) {
    const header = new Header();

    header.setVersion(data.version);
    header.setPrevious(deserializeBuffer(data.previous));
    header.setTime(data.time);
    header.setDifficulty(data.difficulty);
    header.setChecksum(deserializeBuffer(data.checksum));
    header.setHash(hash);

    header.setMeta(
      data.a,
      data.x,
      data.y,
      data.z,
      data.w,
    );

    return header;
  }

  static async load(hash) {
    let data;

    try {
      data = await HeaderDB.get(hash, { keyEncoding: 'binary', valueEncoding: 'binary' });
    } catch (e) {
      return null;
    }

    return Header.fromSaveData(unpackObject(data), hash);
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
      checksum: this.getChecksum(),
      a: this.getA(),
      x: this.getX(),
      y: this.getY(),
      z: this.getZ(),
      w: this.getW(),
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

  randomizeMeta() {
    this.a = randomNumberBetween(1, 2 ** 8);

    this.x = randomNumberBetween(1, 2 ** 32);
    this.y = randomNumberBetween(1, 2 ** 32);
    this.z = randomNumberBetween(1, 2 ** 32);
    this.w = randomNumberBetween(1, 2 ** 32);
  }

  getMeta() {
    return {
      a: this.getA(),
      x: this.getX(),
      y: this.getY(),
      z: this.getZ(),
      w: this.getW(),
    };
  }

  setMeta(a, x, y, z, w) {
    this.setA(a);
    this.setX(x);
    this.setY(y);
    this.setZ(z);
    this.setW(w);
  }

  getA() {
    return this.a;
  }

  setA(a) {
    assert(a > 0 && a <= 256);
    this.a = a;
  }

  getX() {
    return this.x;
  }

  setX(x) {
    assert(x > 0 && x <= 2 ** 32);
    this.x = x;
  }

  getY() {
    return this.y;
  }

  setY(y) {
    assert(y > 0 && y <= 2 ** 32);
    this.y = y;
  }

  getZ() {
    return this.z;
  }

  setZ(z) {
    assert(z > 0 && z <= 2 ** 32);
    this.z = z;
  }

  getW() {
    return this.w;
  }

  setW(w) {
    assert(w > 0 && w <= 2 ** 32);
    this.w = w;
  }

  verifyHash(recalculate = true) {
    assert(this.getHash() !== null);
    assert(this.getA() > 0);

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
    header.setChecksum(deserializeBuffer(obj.checksum));
    header.setVersion(obj.version);
    header.setMeta(obj.a, obj.x, obj.y, obj.z, obj.w);

    return header;
  }

  toObject() {
    const data = {
      hash: this.getHash(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      checksum: this.getChecksum(),
      version: this.getVersion(),
      a: this.getA(),
      x: this.getX(),
      y: this.getY(),
      z: this.getZ(),
      w: this.getW(),
    };

    return serializeObject(data);
  }

  equals(header) {
    // TODO: Check selected keys only
    return JSON.stringify(this.toObject()) === JSON.stringify(header.toObject());
  }
}

module.exports = Header;
