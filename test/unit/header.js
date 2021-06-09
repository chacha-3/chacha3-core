const chai = require('chai');

const Header = require('../../models/header');

const { expect } = chai;

describe('Header', () => {
  it('should create a block header', () => {
    // const header = new Header();
    // TODO:
  });
  it('should get the min target', () => {
    expect(Header.MinTarget).to.be.equals('00ff000000000000000000000000000000000000000000000000000000000000');
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
