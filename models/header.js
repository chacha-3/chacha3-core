/* eslint-disable object-property-newline */
const assert = require('assert');
const blake3 = require('blake3-wasm');

const { HeaderDB } = require('../util/db');
const { config, Env } = require('../util/env');
const { randomNumberBetween } = require('../util/math');

const {
  serializeObject, deserializeBuffer, serializeBuffer, packObject, unpackObject,
} = require('../util/serialize');

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

    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.f = 0;

    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 0;

    this.randomizeMeta();

    this.hash = null;
  }

  static get MinTarget() {
    const { environment } = config;
    return minTarget[environment];
  }

  async save() {
    assert(this.checksum != null);
    assert(this.hash != null);

    const {
      x, y, z, w,
    } = this.getLocation();

    const {
      a, b, c, d, e, f,
    } = this.getProperties();

    const data = {
      version: this.getVersion(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      checksum: this.getChecksum(),
      x, y, z, w,
      a, b, c, d, e, f,
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

    header.setLocation(
      data.x,
      data.y,
      data.z,
      data.w,
    );

    header.setProperties(
      data.a,
      data.b,
      data.c,
      data.d,
      data.e,
      data.f,
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

    const {
      x, y, z, w,
    } = this.getLocation();

    const {
      a, b, c, d, e, f,
    } = this.getProperties();

    const data = {
      version: this.getVersion(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      checksum: this.getChecksum(),
      x, y, z, w,
      a, b, c, d, e, f,
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
    this.setLocation(
      randomNumberBetween(1, 2 ** 32),
      randomNumberBetween(1, 2 ** 32),
      randomNumberBetween(1, 2 ** 32),
      randomNumberBetween(1, 2 ** 32),
    );

    this.setProperties(
      randomNumberBetween(1, 2 ** 8),
      randomNumberBetween(1, 2 ** 8),
      randomNumberBetween(1, 2 ** 8),
      randomNumberBetween(1, 2 ** 8),
      randomNumberBetween(1, 2 ** 8),
      randomNumberBetween(1, 2 ** 8),
    );
  }

  getProperties() {
    return {
      [Header.MetaProperty.A]: this.a,
      [Header.MetaProperty.B]: this.b,
      [Header.MetaProperty.C]: this.c,
      [Header.MetaProperty.D]: this.d,
      [Header.MetaProperty.E]: this.e,
      [Header.MetaProperty.F]: this.f,
    };
  }

  setProperties(a, b, c, d, e, f) {
    assert([a, b, c, d, e, f].find((val) => val < 1 && val > 2 ** 8) === undefined);

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  getLocation() {
    return {
      [Header.MetaLocation.X]: this.x,
      [Header.MetaLocation.Y]: this.y,
      [Header.MetaLocation.Z]: this.z,
      [Header.MetaLocation.W]: this.w,
    };
  }

  setLocation(x, y, z, w) {
    assert([x, y, z, w].find((val) => val < 1 && val > 2 ** 32) === undefined);

    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  getMeta() {
    return Object.assign(this.getLocation(), this.getProperties());
  }

  verifyHash(recalculate = true) {
    assert(this.getHash() !== null);
    // const { a } = this.getProperties();

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
    header.setLocation(obj.x, obj.y, obj.z, obj.w);
    header.setProperties(obj.a, obj.b, obj.c, obj.d, obj.e, obj.f);

    return header;
  }

  toObject() {
    const {
      x, y, z, w,
    } = this.getLocation();

    const {
      a, b, c, d, e, f,
    } = this.getProperties();

    const data = {
      hash: this.getHash(),
      previous: this.getPrevious(),
      time: this.getTime(),
      difficulty: this.getDifficulty(),
      checksum: this.getChecksum(),
      version: this.getVersion(),
      x, y, z, w,
      a, b, c, d, e, f,
    };

    return serializeObject(data);
  }

  equals(header) {
    // TODO: Check selected keys only
    return JSON.stringify(this.toObject()) === JSON.stringify(header.toObject());
  }
}

Header.MetaProperty = {
  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
};

Header.MetaLocation = {
  X: 'x',
  Y: 'y',
  Z: 'z',
  W: 'w',
};

module.exports = Header;
