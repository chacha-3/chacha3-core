const { test } = require('tap');
// const chai = require('chai');

const Header = require('../../models/header');
const mock = require('../../util/mock');

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
  const header = block.getHeader();

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
