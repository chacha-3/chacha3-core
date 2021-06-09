const chai = require('chai');
const dirtyChai = require('dirty-chai');

const Wallet = require('../../models/wallet');
const Transaction = require('../../models/transaction');

const { expect } = chai;
chai.use(dirtyChai);

describe('Transaction', () => {
  it('should create a verified transaction', () => {
    const sender = new Wallet();
    sender.generate();

    const receiver = new Wallet();
    receiver.generate();

    const transaction = new Transaction(
      sender.getKeys().publicKey, receiver.getAddress(), 0, 0,
    );

    const { privateKey } = sender.getKeys();
    transaction.sign(privateKey);

    const { length } = transaction.getSignature();

    expect(length >= 102 || length <= 104).to.be.true();
    expect(transaction.verify()).to.be.true();
  });
  it('should fail verification with invalid transaction signature', () => {
    const sender = new Wallet();
    sender.generate();

    const receiver = new Wallet();
    receiver.generate();

    const transaction = new Transaction(
      sender.getKeys().publicKey, receiver.getAddress(), 0, 0,
    );

    const { privateKey } = sender.getKeys();
    transaction.sign(privateKey);

    // Tamper signature byte
    transaction.signature[2] += Math.floor(Math.random() * 10) + 1;

    expect(transaction.verify()).to.equal(false);
  });
});
