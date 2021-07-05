const level = require('level');
const sub = require('subleveldown');

function runningManualTest() {
  return process.argv[0].includes('node') && process.argv[1].includes('test');
}

const dbName = (process.env.NODE_ENV === 'test' || runningManualTest()) ? 'testdata' : 'data';

const DB = level(dbName);
const WalletDB = sub(DB, 'wallet');

module.exports = {
  WalletDB,
};
