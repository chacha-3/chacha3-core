const { test } = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');

// const { expect } = chai;
// chai.use(dirtyChai);

test('should create a verified transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddressEncoded(), 10,
  );

  // const { privateKey } = sender.getKeys();
  transaction.sign(sender.getPrivateKeyObject());

  const { length } = transaction.getSignature();

  t.equal(length >= 102 || length <= 104, true, 'signature length between 102 and 104');
  t.equal(transaction.verify(), true, 'transaction verified after signed');
  t.end();
});

test('should have ID for transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);
  t.equal(transaction.getId().length, 32);

  t.end();
});

test('should fail verification with none or invalid transaction signature', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), receiver.getAddressEncoded(), 10,
  );

  // const { privateKey } = sender.getKeys();
  t.equal(transaction.verify(), false, 'transaction unverified before signing');

  transaction.sign(sender.getPrivateKeyObject());

  t.equal(transaction.verify(), true, 'transaction verified after signing');

  // Tamper signature byte
  transaction.signature[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(transaction.verify(), false, 'fail verification with incorrect signature');
  t.end();
});

test('should not be valid when signed with incorrect private key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const otherWallet = new Wallet();
  otherWallet.generate();

  const transaction = new Transaction(
    wallet.getPublicKey(), '114mRHezWdQx7MMTJ8QFokoqUraoB4ivKF', 55,
  );

  transaction.sign(otherWallet.getPrivateKeyObject());

  t.equal(transaction.verify(), false, 'invalid sign key');
  t.end();
});

test('should fail verification with invalid wallet address', (t) => {
  const sender = new Wallet();
  sender.generate();

  const transaction = new Transaction(
    sender.getPublicKey(), '114mRHezWdQx7MMTJ8QFokoqUraoB4ivK9', 10,
  );
  transaction.sign(sender.getPrivateKeyObject());

  t.equal(transaction.verify(), false, 'invalid address to send');
  t.end();
});

test('have correct hash data for transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);

  const hashData = JSON.parse(transaction.hashData());

  t.equal(hashData.version, 1);
  t.equal(hashData.receiverAddress, receiver.getAddressEncoded().toString('hex')); // FIXME: Why hex?
  t.equal(hashData.amount, 20);
  t.equal(hashData.senderKey, sender.getPublicKey().toString('hex'));

  t.end();
});

test('have correct hash data for coinbase transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(null, receiver.getAddressEncoded(), 50);

  const hashData = JSON.parse(transaction.hashData());

  t.equal(hashData.version, 1);
  t.equal(hashData.receiverAddress, receiver.getAddressEncoded().toString('hex'));
  t.equal(hashData.amount, 50);
  t.equal(hashData.senderKey, undefined);

  t.end();
});

test('save and load transaction', async (t) => {
  // const block = mock.blockWithTransactions(3);
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const coinbase = new Transaction(null, receiver.getAddressEncoded(), 10);

  const transaction = new Transaction(sender.getPublicKey(), receiver.getAddressEncoded(), 20);
  transaction.sign(sender.getPrivateKeyObject());

  await Transaction.save(coinbase);
  await Transaction.save(transaction);

  const loadedCoinbase = await Transaction.load(coinbase.getId());

  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getReceiverAddress(), loadedCoinbase.getReceiverAddress());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());
  t.equal(loadedCoinbase.getSenderKey(), null);
  t.equal(loadedCoinbase.getSignature(), null);

  const loadedTransaction = await Transaction.load(transaction.getId());

  t.equal(coinbase.getVersion(), loadedCoinbase.getVersion());
  t.equal(coinbase.getReceiverAddress(), loadedCoinbase.getReceiverAddress());
  t.equal(coinbase.getAmount(), loadedCoinbase.getAmount());

  t.ok(transaction.getSenderKey().equals(loadedTransaction.getSenderKey()));
  t.ok(transaction.getSignature().equals(loadedTransaction.getSignature()));

  Transaction.clearAll();

  t.end();
});
