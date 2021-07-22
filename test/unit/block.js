const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

test('creat a block with coinbase', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddressEncoded());

  t.equal(block.transactionCount, 1n, 'block only has coinbase transaction');

  const coinbase = block.getTransaction(0);

  t.equal(coinbase.getSignature(), null, 'coinbase has no signature');
  t.equal(coinbase.getSenderKey(), null, 'coinbase has no sender');

  t.equal(
    coinbase.getReceiverAddress().toString('hex'),
    wallet.getAddressEncoded().toString('hex'),
    'coinbase address matches wallet address',
  );

  t.end();
});

test('should mine a block', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddressEncoded());
  block.mine();

  t.equal(block.verify(), true, 'mined block is verified');

  t.end();
});

test('get object representation of a block', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddressEncoded());

  const transaction1 = new Transaction(
    sender.getPublicKey(),
    receiver.getAddressEncoded(),
    200,
  );

  transaction1.sign(sender.getPrivateKeyObject());

  block.addTransaction(transaction1);
  block.mine();

  console.log(block.toObject());

  t.end();
});
