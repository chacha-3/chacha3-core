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
  header.setNonce(1001);
  header.setChecksum(deserializeBuffer('0x9458ce26540230e67cda20898bb6684b79701790408aa754be0529415c73c92c'));

  const data = JSON.parse(header.hashData());

  const results = [
    { key: 'version', value: 1 },
    { key: 'previous', value: '0x00000fab1cf7748fddbae24a129cd0fd55d5fc41beaeaca0658af2d940c541bc'},
    { key: 'time', value: 1000000233 },
    { key: 'difficulty', value: 1 },
    { key: 'nonce', value: 1001 },
    { key: 'checksum', value: '0x9458ce26540230e67cda20898bb6684b79701790408aa754be0529415c73c92c'},
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

test('increment the nonce', (t) => {
  const header = new Header();

  const initialNonce = header.getNonce();

  for (let i = 1; i <= 2; i += 1) {
    header.incrementNonce();
    t.equal(header.getNonce(), initialNonce + i);
  }

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

  const key = header.getHash();
  t.ok(key.equals(header.getHash()), 'key is correct');
  t.equal(key.length, 32, 'key length is 32');

  const loaded = await Header.load(key);

  t.equal(loaded.getVersion(), header.getVersion(), 'loaded version matches');
  t.equal(loaded.getTime(), header.getTime(), 'loaded time matches');
  t.equal(loaded.getDifficulty(), header.getDifficulty(), 'loaded difficulty matches');
  t.equal(loaded.getNonce(), header.getNonce(), 'loaded nonce matches');

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

  const data = header.toObject();
  const loaded = Header.fromObject(data);

  t.ok(loaded.getHash().equals(header.getHash()));
  t.ok(loaded.getPrevious().equals(header.getPrevious()));
  t.ok(loaded.getChecksum().equals(header.getChecksum()));

  t.equal(loaded.getTime(), header.getTime());
  t.equal(loaded.getDifficulty(), header.getDifficulty());
  t.equal(loaded.getNonce(), header.getNonce());
  t.equal(loaded.getVersion(), header.getVersion());

  t.end();
});

test('unable to load unsaved header', async (t) => {
  const block = await mock.blockWithTransactions(1);
  const loaded = await Header.load(block.getHeader().getHash());

  t.equal(loaded, null, 'unsaved header load with value null');
  t.end();
});
