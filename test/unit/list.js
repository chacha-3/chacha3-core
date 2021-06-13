const { test } = require('tap');

const IndexList = require('../../models/list');

test('create an empty index list', async (t) => {
  const list = new IndexList('itemName');
  list.loadItems();

  t.equal(list.getSize(), 0);
});

test('add items to the list', async (t) => {
  const list = new IndexList('music');
  await list.loadItems();

  const promises = [];
  const addItem = (i) => new Promise((resolve) => {
    const item = `jazz${i}`;

    list.addItem(item).then(() => {
      resolve(item);
    });
  });

  for (let i = 0; i < 3; i += 1) {
    promises.push(addItem(i));
  }

  const addedItems = await Promise.all(promises);
  const updatedList = await list.getItems();

  for (let i = 0; i < 3; i += 1) {
    t.equal(addedItems[i], updatedList[i], `Added item index ${i} matches`);
  }

  await list.clearItems();
});

test('clear items from list', async (t) => {
  const list = new IndexList('music');

  const promises = [];
  const addItem = (i) => new Promise((resolve) => {
    const item = `rock${i}`;

    list.addItem(item).then(() => {
      resolve(item);
    });
  });

  for (let i = 0; i < 3; i += 1) {
    promises.push(addItem(i));
  }

  list.getItems();
  t.equal(list.getSize(), 3);

  await list.clearItems();

  list.getItems();
  t.equal(list.getSize(), 0);

  await list.clearItems();
});

test('remove item by key from list', async (t) => {
  const list = new IndexList('music');

  const promises = [];
  const addItem = (i) => new Promise((resolve) => {
    const item = `metal${i}`;

    list.addItem(item).then(() => {
      resolve(item);
    });
  });

  for (let i = 0; i < 3; i += 1) {
    promises.push(addItem(i));
  }

  await list.removeItem('metal1');

  const updated = list.getItems();

  t.equal(updated[0], 'metal0');
  t.equal(updated[1], 'metal2');

  const reloaded = list.getItems();
  await list.loadItems();

  t.equal(reloaded[0], 'metal0');
  t.equal(reloaded[1], 'metal2');

  await list.clearItems();
});
