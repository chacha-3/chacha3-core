const tap = require('tap');
// const chai = require('chai');
// const dirtyChai = require('dirty-chai');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');

// const { expect } = chai;
// chai.use(dirtyChai);

tap.test('should create a verified transaction', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getKeys().publicKey, receiver.getAddress(), 10,
  );

  const { privateKey } = sender.getKeys();
  transaction.sign(privateKey);

  const { length } = transaction.getSignature();

  t.equal(length >= 102 || length <= 104, true);
  t.equal(transaction.verify(), true);
  t.end();
});

tap.test('should fail verification with none or invalid transaction signature', (t) => {
  const sender = new Wallet();
  sender.generate();

  const receiver = new Wallet();
  receiver.generate();

  const transaction = new Transaction(
    sender.getKeys().publicKey, receiver.getAddress(), 10,
  );

  const { privateKey } = sender.getKeys();
  t.equal(transaction.verify(), false);

  transaction.sign(privateKey);

  t.equal(transaction.verify(), true);

  // Tamper signature byte
  transaction.signature[2] += Math.floor(Math.random() * 10) + 1;

  t.equal(transaction.verify(), false);
  t.end();
});
