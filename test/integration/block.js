const { test } = require('tap');

const mock = require('../../util/mock');

const Wallet = require('../../models/wallet');

const { runAction } = require('../../actions');
const { WalletDB } = require('../../util/db');
const { SuccessCode } = require('../../util/rpc');

const Chain = require('../../models/chain');
const Block = require('../../models/block');
const app = require('../../app')();

test('get block info', async (t) => {
  const block = await mock.blockWithTransactions(5);
  await Block.save(block);

  const { data } = await runAction({
    action: 'blockInfo',
    hash: block.getHeader().getHash().toString('hex'),
  });

  const loaded = Block.fromObject(data);
  t.equal(loaded.verify(), true, 'Loaded block is verified');
  t.equal(loaded.getTransactionCount(), block.getTransactionCount());

  t.ok(loaded.getTransaction(0).getId().equals(block.getTransaction(0).getId()));

  t.end();
});
