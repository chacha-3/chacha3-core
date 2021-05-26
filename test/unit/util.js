const crypto = require('crypto');
const chai = require('chai');

const Wallet = require('../../models/wallet');
const Header = require('../../models/header');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const { expect } = chai;


describe('Util', () => {
  describe('Wallet', () => {
    it('should create a wallet key', () => {
      const wallet = new Wallet();
    
      const { privateKey, publicKey } = wallet.getKeysBuffer();
    
      expect(privateKey).to.have.length(128);
      expect(publicKey).to.have.length(84);
    });
    it('should get wallet address', () => {
      const wallet = new Wallet();
      
      const address = wallet.getAddress();
      expect(address.length).to.be.eq(25);
      expect(address[0]).to.be.eq(0);
    });
    it('should get encoded wallet address', () => {
      const wallet = new Wallet();
      
      const encoded = wallet.getAddressEncoded();
      expect(encoded[0]).to.be.eq('1');
    });
  });
  describe('Header', () => {
    it('should create a block header', () => {
      const header = new Header();
    });
  });
  describe('Block', () => {
    it('should create a block', () => {
      const block = new Block();
      // console.log(header.hash())
    });
  });
  describe('Transaction', () => {
    it('should create a transaction', () => {
      const sender = new Wallet();
      const receiver = new Wallet();

      const transaction = new Transaction(
        sender.getKeysBuffer().publicKey, receiver.getKeysBuffer().publicKey, 0, 0
      );

      transaction.sign(sender.privateKey);
      expect(transaction.getSignature()).to.have.length(66);

      expect(transaction.verify()).to.equal(true);

    });
    // it('should create a coinbase transaction', () => {
    //   const receiver = new Wallet();

    //   const transaction = new Transaction(
    //     null, receiver.getKeysBuffer().publicKey, 0, 0
    //   );

    //   transaction.sign(receiver.privateKey);
    //   expect(transaction.getSignature()).to.have.length(66);
    // });
  });
});
