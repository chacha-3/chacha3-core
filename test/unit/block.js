const chai = require('chai');

const Wallet = require('../../models/wallet');
const Block = require('../../models/block');

const { expect } = chai;

describe('Block', () => {
  it('should create a block with coinbase', () => {
    const wallet = new Wallet();
    wallet.generate();

    const block = new Block();
    block.addCoinbase(wallet.getAddress());

    expect(block.transactionCount).to.be.equal(1n);

    const coinbase = block.getTransaction(0);
    expect(coinbase.getSignature()).to.be.null();
    expect(coinbase.getSender()).to.be.null();

    expect(coinbase.getReceiverAddress().toString('hex')).to.be.equal(wallet.getAddress().toString('hex'));
  });
  // it('should get the min block target', () => {
  //   const block = new Block();
  //   block.
  // });
  it('should mine a block', () => {
    const wallet = new Wallet();
    wallet.generate();

    const block = new Block();
    block.addCoinbase(wallet.getAddress());
    block.mine();

    expect(block.verify()).to.be.true();
  });
});
