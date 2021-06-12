const tap = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');

tap.test('creat a block with coinbase', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());

  t.equal(block.transactionCount, 1n, 'block only has coinbase transaction');

  const coinbase = block.getTransaction(0);

  t.equal(coinbase.getSignature(), null, 'coinbase has no signature');
  t.equal(coinbase.getSenderKey(), null, 'coinbase has no sender');

  t.equal(
    coinbase.getReceiverAddress().toString('hex'),
    wallet.getAddress().toString('hex'),
    'coinbase address matches wallet address',
  );

  t.end();
});

tap.test('should mine a block', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddress());
  block.mine();

  t.equal(block.verify(), true, 'mined block is verified');

  t.end();
});
