const crypto = require('crypto');
const { test } = require('tap');
// const chai = require('chai');

const Header = require('../../models/header');
const mock = require('../../util/mock');
const { headers } = require('../../util/peer-response');
const { deserializeBuffer } = require('../../util/serialize');

// const { expect } = chai;

test('create a block header', (t) => {
  const header = new Header();
  t.equal(typeof header.time, 'number', 'Header time is set');
  t.end();
});

test('get the min target', (t) => {
  // t.equal(Header.MinTarget, 'ffffffffffffffffffff00000000000000000000000000000000000000000000');
  t.end();
});

test('get difficulty target', (t) => {
  const header = new Header();

  // Difficulty 1 by default
  t.equal(header.getTarget(), BigInt(Header.MinTarget));

  header.setDifficulty(2);
  t.equal(header.getTarget(), BigInt(Header.MinTarget) / 2n);

  // Rounded
  header.setDifficulty(12.33);
  t.equal(header.getTarget(), BigInt(Header.MinTarget) / 12n);

  // Difficulty is rounded up but cannot be less than 1
  header.setDifficulty(0.25);
  t.equal(header.getTarget(), BigInt(Header.MinTarget));

  t.end();
});

test('hash data is correct', (t) => {
  const header = new Header();
  header.setVersion(1);
  header.setPrevious(deserializeBuffer('0x00000fab1cf7748fddbae24a129cd0fd55d5fc41beaeaca0658af2d940c541bc'));
  header.setTime(1000000233);
  header.setDifficulty(1);
  header.setChecksum(deserializeBuffer('0x9458ce26540230e67cda20898bb6684b79701790408aa754be0529415c73c92c'));
  header.setLocation(10, 20, 30, 50);
  header.setProperties(10, 20, 30, 40, 50, 60);

  const data = JSON.parse(header.hashData());

  const results = [
    { key: 'version', value: 1 },
    { key: 'previous', value: '0x00000fab1cf7748fddbae24a129cd0fd55d5fc41beaeaca0658af2d940c541bc' },
    { key: 'time', value: 1000000233 },
    { key: 'difficulty', value: 1 },
    { key: 'checksum', value: '0x9458ce26540230e67cda20898bb6684b79701790408aa754be0529415c73c92c' },
    { key: 'x', value: 10 },
    { key: 'y', value: 20 },
    { key: 'z', value: 30 },
    { key: 'w', value: 50 },
    { key: 'a', value: 10 },
    { key: 'b', value: 20 },
    { key: 'c', value: 30 },
    { key: 'd', value: 40 },
    { key: 'e', value: 50 },
    { key: 'f', value: 60 },
  ];

  // Order of keys is important to ensure hash has same output
  Object.keys(data).forEach((key, index) => {
    t.equal(key, results[index].key);
    t.equal(data[key], results[index].value);
  });

  t.end();
});

test('should get the difficulty', (t) => {
  const header = new Header();
  t.equal(header.getDifficulty(), 1);
  t.end();
});

test('set meta data', (t) => {
  const header = new Header();
  header.setLocation(10000, 20000, 30000, 40000);
  header.setProperties(10, 20, 30, 40, 50, 60);

  const {
    x, y, z, w,
  } = header.getLocation();

  const {
    a, b, c, d, e, f,
  } = header.getProperties();

  t.equal(x, 10000);
  t.equal(y, 20000);
  t.equal(z, 30000);
  t.equal(w, 40000);

  t.equal(a, 10);
  t.equal(b, 20);
  t.equal(c, 30);
  t.equal(d, 40);
  t.equal(e, 50);
  t.equal(f, 60);

  t.end();
});

test('randomize meta', (t) => {
  const header = new Header();

  const oldLocation = header.getLocation();
  const oldProperties = header.getProperties();

  header.randomizeMeta();

  const newLocation = header.getLocation();
  const newProperties = header.getProperties();

  Object.keys(oldLocation).forEach((key) => {
    t.not(oldLocation[key], newLocation[key]);
  });

  Object.keys(oldProperties).forEach((key) => {
    t.not(oldProperties[key], newProperties[key]);
  });

  t.end();
});

// test('get object representation of header', (t) => {
//   const header = new Header();
//   const result = header.toObject();

//   const properties = ['version', 'checksum', 'date', 'difficulty', 'nonce'];

//   properties.forEach((property) => {
//     t.ok(Object.prototype.hasOwnProperty.call(result, property));
//   });

//   t.end();
// });

test('save and load header', async (t) => {
  const block = await mock.blockWithTransactions(1);
  const header = block.getHeader();
  await header.save();

  const savedLocation = header.getLocation();
  const savedProperties = header.getProperties();

  const key = header.getHash();
  t.ok(key.equals(header.getHash()), 'key is correct');
  t.equal(key.length, 32, 'key length is 32');

  const loaded = await Header.load(key);

  const loadedLocation = header.getLocation();
  const loadedProperties = header.getProperties();

  t.equal(loaded.getVersion(), header.getVersion(), 'loaded version matches');
  t.equal(loaded.getTime(), header.getTime(), 'loaded time matches');
  t.equal(loaded.getDifficulty(), header.getDifficulty(), 'loaded difficulty matches');

  Object.keys(savedLocation).forEach((locationKey) => {
    t.equal(savedLocation[locationKey], loadedLocation[locationKey]);
  });

  Object.keys(savedProperties).forEach((propertyKey) => {
    t.equal(savedProperties[propertyKey], loadedProperties[propertyKey]);
  });

  t.ok(loaded.getChecksum().equals(header.getChecksum()), 'loaded checksum matches');
  t.ok(loaded.getHash().equals(header.getHash()), 'loaded hash matches');

  await Header.clear(key);

  t.end();
});

test('clear header', async (t) => {
  const block = await mock.blockWithTransactions(1);
  const header = block.getHeader();

  await header.save();

  const hash = header.getHash();

  await Header.clear(hash);
  const loaded = await Header.load(hash);

  t.equal(loaded, null);
  t.end();
});

test('unable to load unsaved header', async (t) => {
  const block = await mock.blockWithTransactions(1);
  const loaded = await Header.load(block.getHeader().getHash());

  t.equal(loaded, null, 'unsaved header load with value null');
  t.end();
});

test('to and from header object', async (t) => {
  const block = await mock.blockWithTransactions(1);

  const previous = crypto.randomBytes(32);

  const header = block.getHeader();
  header.setPrevious(previous);

  const beforeLocation = header.getLocation();
  const beforeProperties = header.getProperties();

  const data = header.toObject();
  const loaded = Header.fromObject(data);

  t.ok(loaded.getHash().equals(header.getHash()));
  t.ok(loaded.getPrevious().equals(header.getPrevious()));
  t.ok(loaded.getChecksum().equals(header.getChecksum()));

  t.equal(loaded.getTime(), header.getTime());
  t.equal(loaded.getDifficulty(), header.getDifficulty());
  t.equal(loaded.getVersion(), header.getVersion());

  const afterLocation = header.getLocation();
  const afterProperties = header.getProperties();

  Object.keys(beforeLocation).forEach((key) => {
    t.equal(beforeLocation[key], afterLocation[key]);
  });

  Object.keys(beforeProperties).forEach((key) => {
    t.equal(beforeProperties[key], afterProperties[key]);
  });

  t.end();
});

test('unable to load unsaved header', async (t) => {
  const block = await mock.blockWithTransactions(1);
  const loaded = await Header.load(block.getHeader().getHash());

  t.equal(loaded, null, 'unsaved header load with value null');
  t.end();
});

test('verify hash is valid', async (t) => {
  const block = await mock.blockWithTransactions(1);

  t.equal(await block.header.verifyHash(), true);
  t.equal(await block.header.verifyHash(true), true);
  t.equal(await block.header.verifyHash(false), true);

  // Tamper block invalid hash that meets difficulty
  block.header.hash = deserializeBuffer('0x0000000000000000ffffffffffffffffffffffffffffffffffffffffffffff00');
  t.equal(await block.header.verifyHash(true), false);
  t.equal(await block.header.verifyHash(false), true);

  // Tamper block invalid hash that does not meet difficulty
  block.header.hash = deserializeBuffer('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00');
  t.equal(await block.header.verifyHash(true), false);
  t.equal(await block.header.verifyHash(false), false);

  t.end();
});
