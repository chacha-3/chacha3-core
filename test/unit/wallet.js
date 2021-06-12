const crypto = require('crypto');
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

tap.test('walley key objects', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeys();

  t.type(typeof (privateKey), 'object');
  t.type(typeof (publicKey), 'object');

  t.end();
});

tap.test('wallet key in pem format', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysPem();

  t.equal(privateKey.startsWith('-----BEGIN PRIVATE KEY-----'), true);
  t.equal(publicKey.startsWith('-----BEGIN PUBLIC KEY-----'), true);

  t.end();
});

tap.test('should get wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const address = wallet.getAddress();
  t.equal(address.length, 25, 'address length is 25');
  t.equal(address[0], 0, 'address starts with 0');
  t.end();
});

tap.test('should get encoded wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const encoded = wallet.getAddressEncoded();

  t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix, 'wallet has prefix');
  t.equal(encoded[Wallet.AddressPrefix.length], '1', 'wallet encoded address starts with 1');

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
