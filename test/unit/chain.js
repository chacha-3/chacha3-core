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

test('add block hashes to the chain', (t) => {
  const numOfBlocks = 3;

  const blocks = Array.from({ length: 10 }, () => mock.blockWithTransactions(5));


  const chain = new Chain();

  for (let i = 0; i < numOfBlocks; i += 1) {
    chain.addBlockHash(blocks[i].getHeader().getHash());
  }

  t.equal(chain.getHeight(), numOfBlocks, 'chain has correct height');
  t.end();
});

test('save and load chain', async (t) => {
  const chain = mock.chainWithBlocks(3, 5);
  const { key, data } = await Chain.save(chain);

  t.equal(key, 'chain');

  t.end();
});
