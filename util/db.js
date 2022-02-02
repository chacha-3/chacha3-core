const level = require('level');
const sub = require('subleveldown');
const { isTestEnvironment, runningManualTest, Env } = require('./env');

// Probably and underfit solution. But no issues
// TODO: Migrate to env util
// function runningManualTest(argv) {
//   if (argv.length === 0) {
//     return false;
//   }

//   return argv[0].includes('node') && argv[1].includes('test');
// }

// const dataDir = '../data';
// if (!fs.existsSync(dataDir)) {
//   fs.mkdirSync(dataDir);
// }

const dbNameMap = {
  [Env.Production]: 'data',
  [Env.Staging]: 'testdata',
  [Env.Development]: '.devdata',
  [Env.Testing]: '.localdata',
};

// TODO: Set default environment / check env is set
const dbName = dbNameMap[process.env.NODE_ENV];

const DB = level(dbName);

const WalletDB = sub(DB, 'wallet');
const BlockDB = sub(DB, 'block');
const ChainDB = sub(DB, 'chain');
const HeaderDB = sub(DB, 'header');
const TransactionDB = sub(DB, 'transaction');
const PendingTransactionDB = sub(DB, 'pending_transaction');

const PeerDB = sub(DB, 'peer');

module.exports = {
  DB,
  WalletDB,
  BlockDB,
  ChainDB,
  HeaderDB,
  TransactionDB,
  PendingTransactionDB,
  PeerDB,
  // runningManualTest, // Export to use for unit test
};
