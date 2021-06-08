const crypto = require('crypto');
const chai = require('chai');

const Wallet = require('../../models/wallet');
const Header = require('../../models/header');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const { expect } = chai;

describe('Block', () => {
  it('should create a block with coinbase', () => {
    const creator = new Wallet();
  
    const block = new Block();
    block.addCoinbase(creator.getAddress());

    expect(block.transactionCount).to.be.equal(1n);

    const coinbase = block.getTransaction(0);
    expect(coinbase.getSignature()).to.be.null;
    expect(coinbase.getSender()).to.be.null;

    expect(coinbase.getReceiverAddress().toString('hex')).to.be.equal(creator.getAddress().toString('hex'));
  });
  it('should get the min block target', () => {
    const block = new Block();
  });
  it('should mine a block', () => {
    const creator = new Wallet();
  
    const block = new Block();
    block.addCoinbase(creator.getAddress());

    // This hash may be verified without mining with very low probability.
    // It's okay if this test fails on very rare occasions
    // Might remove this test
    expect(block.verify()).to.be.false;

    block.mine();

    expect(block.verify()).to.be.true;
  });
});
