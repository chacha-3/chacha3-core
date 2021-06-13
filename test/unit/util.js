const { test } = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const DB = require('../../util/database');

// const { expect } = chai;
// chai.use(dirtyChai);

test('should read, write, and delete number data', async (t) => {
  const itemName = 'block';
  const itemId = '100';

  await DB.put(itemName, itemId, 2003);

  const value = await DB.get(itemName, itemId);
  t.equal(value, 2003);

  await DB.del(itemName, itemId);

  const result = await DB.get(itemName, itemId);
  t.equal(result, null);
});

test('should read, write, and delete string data', async (t) => {
  const itemName = 'block';
  const itemId = '100';

  await DB.put(itemName, itemId, 'pop rock');

  const value = await DB.get(itemName, itemId);
  t.equal(value, 'pop rock');

  await DB.del(itemName, itemId);

  const result = await DB.get(itemName, itemId);
  t.equal(result, null);
});

test('should read, write, and delete object data', async (t) => {
  const itemName = 'block';
  const itemId = '100';

  await DB.put(itemName, itemId, { data: 'message' });

  const value = await DB.get(itemName, itemId);
  t.equal(value.data, 'message');

  await DB.del(itemName, itemId);

  const result = await DB.get(itemName, itemId);
  t.equal(result, null);
});

test('should be null when not found', async (t) => {
  const result = await DB.get('phone', '101');

  t.equal(result, null, 'key value is null');
  t.end();
});

// test('uncreated index returns empty array', async (t) => {
//   const list = await DB.index('fruit');
//   t.equal(list.length, 0, 'array is empty');
//   t.end();
// });

test('add item index', async (t) => {
  const itemName = 'book';
  const itemId = '202';

  // await DB.addIndex(itemName, itemId);

  // const index = await DB.index(itemName);
  // t.equal(index.length, 1, 'Item added to index');
  // t.equal(index[0], itemId, 'Item value matches');

  // await DB.removeIndex(itemName, itemId);

  t.end();
});

test('does not add duplicate index', async (t) => {
  const itemName = 'book';

  // await DB.addIndex(itemName, 'sameId');
  // await DB.addIndex(itemName, 'sameId');
  // await DB.addIndex(itemName, 'otherId');

  // const index = await DB.index(itemName);
  // t.equal(index.length, 2, 'Item added to index');

  // await DB.removeIndex(itemName, 'sameId');
  // await DB.removeIndex(itemName, 'otherId');

  t.end();
});
