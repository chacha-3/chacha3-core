// const environment = process.env.NODE_ENV || 'development';

const Env = {
  Production: 'production',
  Staging: 'staging',
  Testing: 'testing',
  Development: 'development',
};

const config = {
  port: process.env.PORT || 5438,
  host: process.env.HOST || '',
  environment: process.env.NODE_ENV || Env.Development,
  // chainId: (environment === 'production') ? 'chacha3_main_v1' : 'chacha3_dev_v1',
};

const isTestEnvironment = () => {
  const { Testing } = Env;
  return process.env.NODE_ENV === Testing;
};

module.exports = {
  Env,
  isTestEnvironment,
  config,
};
