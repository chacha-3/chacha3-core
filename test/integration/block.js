const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const app = require('../../app')();

test('push new block', async (t) => {
  // const block = await mock.blockWithTransactions();

  // const { data } = await runAction({
  //   action: 'chainInfo',
  // });

  // t.equal(data.length, chain.getLength());
  // t.equal(data.currentDifficulty, chain.getCurrentDifficulty());
  // t.equal(data.totalWork, chain.getTotalWork());

  // Chain.clear();
  t.end();
});
