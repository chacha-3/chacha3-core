const { test } = require('tap');
// const chai = require('chai');

const Header = require('../../models/header');

// const { expect } = chai;

test('create a block header', (t) => {
  // const header = new Header();
  t.end();
});

test('get the min target', (t) => {
  t.equal(Header.MinTarget, '00ff000000000000000000000000000000000000000000000000000000000000');
  t.end();
});

test('get difficulty target', (t) => {
  const header = new Header();

  // Difficulty 1 by default
  t.equal(header.getTarget(), '00ff000000000000000000000000000000000000000000000000000000000000');

  header.setDifficulty(2);
  t.equal(header.getTarget(), '007f800000000000000000000000000000000000000000000000000000000000');
  t.end();
});

test('should get the difficulty', (t) => {
  const header = new Header();
  t.equal(header.getDifficulty(), 1);
  t.end();
});

test('get object representation of header', (t) => {
  const header = new Header();

  // TODO:
  // t.equal(header.getDifficulty(), 1);
  t.end();
});
