const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Chain = require('../../models/chain');

const mock = require('../../util/mock');

test('create an empty chain', (t) => {
  const chain = new Chain();
  t.equal(chain.getHeight(), 0, 'empty chain has height of 0');

  t.end();
});

test('add block hashes to the chain', async (t) => {
  const numOfBlocks = 3;

  const blocks = await Promise.all(
    Array.from({ length: numOfBlocks }, () => new Promise((resolve) => {
      resolve(mock.blockWithTransactions(5));
    })),
  );

  const chain = new Chain();

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.addBlockHash(blocks[i]);
  }

  t.equal(chain.getHeight(), numOfBlocks, 'chain has correct height');
  // t.equal(chain.getTotalWork(), numOfBlocks * 1, 'has correct work');

  t.end();
});

test('save and load chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const { key } = await Chain.save(chain);
  t.equal(key, 'chain');

  const loaded = await Chain.load();
  t.equal(loaded.getHeight(), numOfBlocks);

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