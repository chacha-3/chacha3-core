const { test } = require('tap');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const mock = require('../../util/mock');

test('create a block with coinbase', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();
  block.addCoinbase(wallet.getAddressEncoded());

  t.equal(block.transactionCount, 1, 'block only has coinbase transaction');

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

  t.equal(block.verifyHash(), true, 'mined block has verified hash');
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

  t.end();
});

test('verify block with checksum', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddressEncoded());

  const transaction1 = new Transaction(
    sender.getPublicKey(),
    receiver.getAddressEncoded(),
    410,
  );

  transaction1.sign(sender.getPrivateKeyObject());

  block.addTransaction(transaction1);
  block.mine();

  t.equal(block.verifyChecksum(), true);
  t.equal(block.verify(), true);

  // Tamper checksum byte
  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(block.verifyChecksum(), false);
  t.equal(block.verify(), false);

  t.end();
});

test('correct block object format', (t) => {
  const block = mock.blockWithTransactions(3);

  console.log(JSON.stringify(block.toObject(), null, 2));

  t.end();
});
