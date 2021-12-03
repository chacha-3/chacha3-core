const { test } = require('tap');

const mock = require('../../util/mock');

const Chain = require('../../models/chain');

const { runAction } = require('../../actions');
const { SuccessCode } = require('../../util/rpc');

test('display chain info', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(5, 3);

  const chain = Chain.mainChain;
  const { code, data } = await runAction({
    action: 'chainInfo',
  });

  t.equal(code, SuccessCode);
  t.equal(data.length, chain.getLength());
  t.equal(data.currentDifficulty, chain.getCurrentDifficulty());
  t.equal(data.totalWork, chain.getTotalWork());

  await Chain.clearMain();
  t.end();
});

test('full chain header list', async (t) => {
  const numOfBlocks = 5;
  Chain.mainChain = await mock.chainWithBlocks(numOfBlocks, 3);

  const { code, data } = await runAction({
    action: 'pullChain',
  });

  const { blockHeaders } = data;

  t.equal(code, SuccessCode);
  t.equal(blockHeaders.length, numOfBlocks);

  await Chain.clearMain();
  t.end();
});

test('delete chain', async (t) => {
  Chain.mainChain = await mock.chainWithBlocks(5, 3);

  const { code } = await runAction({
    action: 'destroyChain',
  });

  t.equal(code, SuccessCode);
  t.equal(Chain.mainChain.getLength(), 1);

  await Chain.clearMain();
  t.end();
});
