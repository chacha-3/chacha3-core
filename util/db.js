const level = require('level');
const sub = require('subleveldown');

const dbName = (process.env.NODE_ENV === 'test') ? 'testdata' : 'data';

const DB = level(dbName);
const WalletDB = sub(DB, 'wallet');

module.exports = {
  WalletDB,
};
