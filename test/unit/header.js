const crypto = require('crypto');
const chai = require('chai');

const Wallet = require('../../models/wallet');
const Header = require('../../models/header');
const Block = require('../../models/block');
const Transaction = require('../../models/transaction');

const { expect } = chai;

describe('Header', () => {
  it('should create a block header', () => {
    const header = new Header();
  });
  it('should get the min target', () => {
    const header = new Header();
    expect(header.getMinTarget()).to.be.equals('00ff000000000000000000000000000000000000000000000000000000000000');
  });
  it('should get the difficulty target', () => {
    const header = new Header();

    // Difficulty 1 by default
    expect(header.getTarget()).to.be.equals('00ff000000000000000000000000000000000000000000000000000000000000');

    header.setDifficulty(2);
    expect(header.getTarget()).to.be.equals('007f800000000000000000000000000000000000000000000000000000000000');
  });
  it('should get the difficulty', () => {
    const header = new Header();
    expect(header.getDifficulty()).to.be.equals(1);
  });
});