const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');

test('create an empty chain', (t) => {
  const chain = new Chain();
  t.equal(chain.getLength(), 0, 'empty chain has height of 0');

  t.end();
});

test('add block headers to the chain', async (t) => {
  const numOfBlocks = 3;

  const blocks = await Promise.all(
    Array.from({ length: numOfBlocks }, () => mock.blockWithTransactions(5)),
  );

  const chain = new Chain();

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.addBlockHeader(blocks[i].getHeader());
  }

  const headers = chain.getBlockHeaders();
  for (let i = 0; i < numOfBlocks; i += 1) {
    t.ok(headers[i].getHash().equals(blocks[i].getHeader().getHash()));
  }

  t.equal(chain.getLength(), numOfBlocks, 'chain has correct length');
  t.end();
});

test('get total work in chain', async (t) => {
  const numOfBlocks = 4;

  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  t.equal(chain.getTotalWork(), 4);
  t.end();
});

test('save and load chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const { key } = await Chain.save(chain);
  t.equal(key, 'chain');

  const loaded = await Chain.load();
  console.log(loaded);
  t.equal(loaded.getLength(), numOfBlocks);

  Chain.clear();
  t.end();
});

// test('load block headers', async (t) => {
//   const numOfBlocks = 3;
//   const chain = await mock.chainWithBlocks(numOfBlocks, 5);
//   // Chain.saveBlocks(chain);
//   // t.ok(await chain.getBlockHeaders());

//   Chain.clear();
//   t.end();
// });
