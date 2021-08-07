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

test('calculate average block time difference in chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);

  chain.blockHeaders[0].setTime(1628163920000);
  chain.blockHeaders[1].setTime(1628163940000);
  chain.blockHeaders[2].setTime(1628163980000);

  // Average difference in time between blocks
  // (20000 + 40000) / 2 = 30000
  t.equal(chain.getAverageBlockTime(), 30000);

  t.end();
});

test('no average block time when chain has only one block', async (t) => {
  const chain = await mock.chainWithBlocks(1, 3);

  t.equal(chain.getAverageBlockTime(), 0);
  t.end();
});

test('get correct difficulty', async (t) => {
  t.equal(Chain.getAdjustInterval(), 8);
  t.equal(Chain.getExpectedTimePerBlock(), 1000);

  const numOfBlocks = 20;
  const chain = await mock.chainWithBlocks(numOfBlocks, 3);

  const actualTimePerBlock = 600;

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.blockHeaders[i].setTime(1628163920000 + (actualTimePerBlock * i));
  }

  const numOfAdjustments = Math.floor(numOfBlocks / Chain.getAdjustInterval());
  const adjustFactor = Chain.calculateAdjustFactor(
    Chain.getExpectedTimePerBlock(),
    actualTimePerBlock,
  );

  t.equal(chain.getCurrentDifficulty(), adjustFactor ** numOfAdjustments);
  t.end();
});

test('save and load chain', async (t) => {
  const numOfBlocks = 3;
  const chain = await mock.chainWithBlocks(numOfBlocks, 5);
  const { key } = await Chain.save(chain);
  t.equal(key, 'chain');

  const loaded = await Chain.load();

  t.equal(loaded.getLength(), numOfBlocks);
  t.ok(loaded.getBlockHeaders()[0].getHash().equals(chain.getBlockHeaders()[0].getHash()));

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
