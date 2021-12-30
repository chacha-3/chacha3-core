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

const environment = process.env.NODE_ENV || Env.Development;

assert(Object.values(Env).includes(environment));

const config = {
  port: process.env.PORT || 5438,
  host: process.env.HOST || '',
  environment,
  chainId: `chacha3_${envShortCode(environment)}`,
};

const isTestEnvironment = process.env.NODE_ENV === Env.Testing;

module.exports = {
  Env,
  isTestEnvironment,
  config,
};
