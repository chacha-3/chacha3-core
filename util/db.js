const level = require('level');
const sub = require('subleveldown');

// Probably and underfit solution. But no issues
function runningManualTest(argv) {
  if (argv.length === 0) {
    return false;
  }

  return argv[0].includes('node') && argv[1].includes('test');
}

const dbName = (process.env.NODE_ENV === 'test' || runningManualTest(process.argv)) ? 'testdata' : 'data';

const DB = level(dbName);
const WalletDB = sub(DB, 'wallet');
const BlockDB = sub(DB, 'block');
const ChainDB = sub(DB, 'chain');
const HeaderDB = sub(DB, 'header');
const TransactionDB = sub(DB, 'transaction');

module.exports = {
  DB,
  WalletDB,
  BlockDB,
  ChainDB,
  HeaderDB,
  TransactionDB,
  runningManualTest, // Export to use for unit test
};
