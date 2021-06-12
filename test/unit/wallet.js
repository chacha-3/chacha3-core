const tap = require('tap');
// const chai = require('chai');

const Wallet = require('../../models/wallet');

// const { expect } = chai;

tap.test('should create a wallet key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysBuffer();

  t.equal(privateKey.length, 185);
  t.equal(publicKey.length, 120);

  t.end();
});

tap.test('should get wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const address = wallet.getAddress();
  t.equal(address.length, 25);
  t.equal(address[0], 0);
  t.end();
});

tap.test('should get encoded wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const encoded = wallet.getAddressEncoded();

  t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix);
  t.equal(encoded[Wallet.AddressPrefix.length], '1');

  t.end();
});

tap.test('should save a wallet', (t) => {
  const wallet = new Wallet();
  wallet.generate();
  wallet.save();
  t.end();
});

tap.test('should recover a wallet', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  const { privateKey } = oldWallet.getKeys();

  const recoverWallet = new Wallet();
  recoverWallet.recover(privateKey);

  t.equal(recoverWallet.getKeysHex().privateKey, oldWallet.getKeysHex().privateKey);
  t.equal(recoverWallet.getKeysHex().publicKey, oldWallet.getKeysHex().publicKey);
  t.end();
});
