const crypto = require('crypto');
const chai = require('chai');

const Wallet = require('../../models/wallet');
const Header = require('../../models/header');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const { expect } = chai;

describe('Transaction', () => {
  it('should create a verified transaction', () => {
    const sender = new Wallet();
    sender.generate();

    const receiver = new Wallet();
    receiver.generate();

    const transaction = new Transaction(
      sender.getKeys().publicKey, receiver.getAddress(), 0, 0
    );

    const { privateKey } = sender.getKeys();
    transaction.sign(privateKey);

    const length = transaction.getSignature().length;

    expect(length >= 102 || length <= 104).to.be.true;
    expect(transaction.verify()).to.be.true;
  });
  it('should fail verification with invalid transaction signature', () => {
    const sender = new Wallet();
    sender.generate();

    const receiver = new Wallet();
    receiver.generate();

    const transaction = new Transaction(
      sender.getKeys().publicKey, receiver.getAddress(), 0, 0
    );
    
    const { privateKey } = sender.getKeys();
    transaction.sign(privateKey);

    transaction.signature[2] = transaction.signature[2] + 4; // Tamper signature byte

    expect(transaction.verify()).to.equal(false);
  });
});