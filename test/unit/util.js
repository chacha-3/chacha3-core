const tap = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const DB = require('../../util/database');

// const { expect } = chai;
// chai.use(dirtyChai);

tap.test('should read, write, and delete data', async (t) => {
  const itemName = 'block';
  const itemId = '100';

  await DB.put(itemName, itemId, 'pop rock');

  const value = await DB.get(itemName, itemId);
  t.equal(value, 'pop rock');

  await DB.del(itemName, itemId);

  let deleted = false;

  try {
    await DB.get(itemName, itemId);
  } catch (e) {
    deleted = true;
  }

  t.equal(deleted, true);
});

tap.test('should throw an error when not found', async (t) => {
  const itemName = 'error';
  const itemId = '100';

  let readError = false;

  try {
    await DB.get(itemName, itemId);
  } catch (e) {
    t.equal(e.name, 'NotFoundError');
    readError = true;
  }

  t.equal(readError, true);
  t.end();
});
