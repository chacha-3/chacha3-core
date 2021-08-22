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

  t.equal(block.getTransactionCount(), 1, 'block only has coinbase transaction');

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

test('should mine a block', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddressEncoded());
  block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

  await block.mine();

  t.equal(await block.verifyHash(), true, 'mined block has verified hash');
  t.equal(block.verify(), true, 'mined block is verified');

  t.end();
});

test('get object representation of a block', async (t) => {
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
  block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

  await block.mine();

  t.end();
});

test('verify block with checksum', async (t) => {
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
  block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

  await block.mine();

  t.equal(block.verifyChecksum(), true);
  t.equal(block.verify(), true);

  // Tamper checksum byte
  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(block.verifyChecksum(), false);
  t.equal(block.verify(), false);

  t.end();
});

test('checksum is updated when adding transaction', async (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const block = new Block();
  block.addCoinbase(receiver.getAddressEncoded());

  let previousChecksum = null;

  for (let i = 0; i < 3; i += 1) {
    const transaction = new Transaction(
      sender.getPublicKey(),
      receiver.getAddressEncoded(),
      200,
    );

    transaction.sign(sender.getPrivateKeyObject());

    block.addTransaction(transaction);
    block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

    await block.mine();

    if (previousChecksum) {
      t.not(block.getHeader().getChecksum(), previousChecksum, 'Checksum is not the same');
    } else {
      previousChecksum = block.getHeader().getChecksum();
    }
  }

  t.end();
});

test('block is invalid when checksum is incorrect', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddressEncoded());
  block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

  await block.mine();

  block.header.checksum[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(block.verifyChecksum(), false, 'tampered block has invalid checksum');
  t.equal(block.verify(), false, 'tampered block fails verification');

  t.end();
});

test('block is invalid if adding transaction after mining', async (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const block = new Block();

  block.addCoinbase(wallet.getAddressEncoded());
  block.setPreviousHash(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'));

  await block.mine();

  t.equal(block.verifyHash(), true, 'mined block has verified hash');
  t.equal(block.verify(), true, 'mined block is verified');

  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const addTransaction = new Transaction(
    sender.getPublicKey(),
    receiver.getAddressEncoded(),
    200,
  );

  addTransaction.sign(sender.getPrivateKeyObject());

  block.addTransaction(addTransaction);

  // FIXME:
  // t.equal(block.verifyHash(), false, 'tampered transaction has invalid hash');
  // t.equal(block.verify(), false, 'tampered transaction is unverified');

  t.end();
});

test('correct block object format', async (t) => {
  const block = await mock.blockWithTransactions(3);

  t.end();
});

test('save and load block', async (t) => {
  const block = await mock.blockWithTransactions(3);
  const { key } = await Block.save(block);

  const loaded = await Block.load(key);

  // Simple equality check
  // TODO: Add more checks
  t.ok(block.getHeader().getHash().equals(loaded.getHeader().getHash()));
  t.equal(block.getTransactionCount(), loaded.getTransactionCount());

  Block.clearAll();

  t.end();
});
