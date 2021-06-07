const crypto = require('crypto');
const chai = require('chai');

const Wallet = require('../../models/wallet');
const Header = require('../../models/header');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const { expect } = chai;

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
  it('should save a wallet', () => {
    const wallet = new Wallet();
    wallet.save();
  });
});