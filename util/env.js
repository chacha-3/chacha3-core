require('dotenv').config();

const assert = require('assert');

const Env = {
  Production: 'production',
  Staging: 'staging',
  Testing: 'testing',
  Development: 'development',
};

const envShortCode = (env) => {
  const map = {
    [Env.Production]: 'main',
    [Env.Staging]: 'test',
    [Env.Testing]: 'local',
    [Env.Development]: 'dev',
  };

  return map[env];
};

// Check if running the test manually the command line instead of usual `npm test`
// e.g. `node test/unit/block.js`
const isManualTestArgv = (argv) => argv.length > 0 && argv[0].includes('node') && argv[1].includes('test');
const runningManualTest = isManualTestArgv(process.argv);

const environment = (runningManualTest) ? Env.Testing : (process.env.NODE_ENV || Env.Production);
assert(Object.values(Env).includes(environment));

const config = {
  port: Number.parseInt(process.env.PORT, 10) || 5438,
  host: process.env.HOST || '',
  environment,
  chainId: `chacha3-${envShortCode(environment)}chain`,
  networkId: `chacha3-${envShortCode(environment)}net`,
};

const isTestEnvironment = process.env.NODE_ENV === Env.Testing;

module.exports = {
  Env,
  envShortCode,
  isTestEnvironment,
  config,
  runningManualTest,
  isManualTestArgv,
};
