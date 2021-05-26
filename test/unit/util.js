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
    
      expect(privateKey).to.have.length(185);
      expect(publicKey).to.have.length(120);
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
    it('should create a block with coinbase', () => {
      const creator = new Wallet();
      const { publicKey } = creator.getKeys();
    
      const block = new Block();
      block.addCoinbase(publicKey);

      expect(block.transactionCount).to.be.equal(1n);

      const coinbase = block.getTransaction(0);
      expect(coinbase.getSignature()).to.be.null;
      expect(coinbase.getSender()).to.be.null;

      expect(coinbase.getReceiver().export({ format: 'pem', type: 'spki'})).to.be.equal(publicKey.export({ format: 'pem', type: 'spki'}));
    });
    it('should mine a block', () => {
      const creator = new Wallet();
      const { publicKey } = creator.getKeys();
    
      const block = new Block();
      block.addCoinbase(publicKey);

      block.mine();
    });
  });
  describe('Transaction', () => {
    it('should create a verified transaction', () => {
      const sender = new Wallet();
      const receiver = new Wallet();

      const transaction = new Transaction(
        sender.getKeys().publicKey, receiver.getKeys().publicKey, 0, 0
      );

      const { privateKey } = sender.getKeys();
      transaction.sign(privateKey);
  
      const length = transaction.getSignature().length;

      expect(length >= 102 || length <= 104).to.be.true;
      expect(transaction.verify()).to.be.true;
    });
    it('should fail verification with invalid transaction signature', () => {
      const sender = new Wallet();
      const receiver = new Wallet();

      const transaction = new Transaction(
        sender.getKeysBuffer().publicKey, receiver.getKeysBuffer().publicKey, 0, 0
      );
      
      const { privateKey } = sender.getKeys();
      transaction.sign(privateKey);

      transaction.signature[2] = transaction.signature[2] + 4; // Tamper signature byte

      expect(transaction.verify()).to.equal(false);
    });
  });
});
