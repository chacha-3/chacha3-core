const { test } = require('tap');
// const chai = require('chai');

const Wallet = require('../../models/wallet');

// const { expect } = chai;

test('should create a wallet key', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysBuffer();

  t.equal(privateKey.length, 185);
  t.equal(publicKey.length, 120);

  t.end();
});

test('walley key objects', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeys();

  t.type(typeof (privateKey), 'object');
  t.type(typeof (publicKey), 'object');

  t.end();
});

test('wallet key in pem format', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const { privateKey, publicKey } = wallet.getKeysPem();

  t.equal(privateKey.startsWith('-----BEGIN PRIVATE KEY-----'), true);
  t.equal(publicKey.startsWith('-----BEGIN PUBLIC KEY-----'), true);

  t.end();
});

test('should get wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const address = wallet.getAddress();
  t.equal(address.length, 25, 'address length is 25');
  t.equal(address[0], 0, 'address starts with 0');
  t.end();
});

test('should get encoded wallet address', (t) => {
  const wallet = new Wallet();
  wallet.generate();

  const encoded = wallet.getAddressEncoded();

  t.equal(encoded.slice(0, Wallet.AddressPrefix.length), Wallet.AddressPrefix, 'wallet has prefix');
  t.equal(encoded[Wallet.AddressPrefix.length], '1', 'wallet encoded address starts with 1');

  t.end();
});

test('should recover a wallet', (t) => {
  const oldWallet = new Wallet();
  oldWallet.generate();

  const { privateKey } = oldWallet.getKeys();

  const recoverWallet = new Wallet();
  recoverWallet.recover(privateKey);

  t.equal(recoverWallet.getKeysHex().privateKey, oldWallet.getKeysHex().privateKey);
  t.equal(recoverWallet.getKeysHex().publicKey, oldWallet.getKeysHex().publicKey);
  t.end();
});

test('should save and load a wallet', async (t) => {
  const saveWallet = new Wallet();
  saveWallet.generate();
  await saveWallet.save();

  const loadWallet = new Wallet();
  await loadWallet.load(saveWallet.getAddressEncoded());

  t.equal(saveWallet.getKeysHex().privateKey, loadWallet.getKeysHex().privateKey);
  t.equal(saveWallet.getKeysHex().publicKey, loadWallet.getKeysHex().publicKey);

  t.end();
});
