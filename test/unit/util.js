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
      console.log(wallet.privateKey, wallet.publicKey);
      // expect(wallet.privateKey.length).to.be.equal(48);
      // expect(wallet.publicKey.length).to.be.equal(44);
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
      const wallet = new Wallet();
      const transaction = new Transaction();
      transaction.sign(wallet.privateKey);
    
      // console.log(transaction)
      // console.log(header.hash())
    });
  });
});
