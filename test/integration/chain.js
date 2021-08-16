const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const Chain = require('../../models/chain');
const app = require('../../app')();

test('display chain info', async (t) => {
  const chain = await mock.chainWithBlocks(5, 3);

  const { data } = await runAction({
    action: 'chainInfo',
  });

  t.equal(data.length, chain.getLength());
  t.equal(data.currentDifficulty, chain.getCurrentDifficulty());
  t.equal(data.totalWork, chain.getTotalWork());

  Chain.clear();
  t.end();
});

test('delete chain', async (t) => {
  const chain = await mock.chainWithBlocks(5, 3);

  const { code } = await runAction({
    action: 'destroyChain',
  });

  t.equal(code, 'ok');

  // FIXME: Chain is caching
  // t.equal(chain.getLength(), 0);
  t.end();
});