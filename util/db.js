const level = require('level');
const sub = require('subleveldown');

// Probably and underfit solution. But no issues
function runningManualTest(argv) {
  return argv[0].includes('node') && argv[1].includes('test');
}

const dbName = (process.env.NODE_ENV === 'test' || runningManualTest(process.argv)) ? 'testdata' : 'data';

const DB = level(dbName);
const WalletDB = sub(DB, 'wallet');

module.exports = {
  WalletDB,
  runningManualTest, // Export to use for unit test
};
