const { isTestEnvironment } = require('./env');

// Lower for testing to speed up
const pollInterval = isTestEnvironment ? 5 : 100;

const waitUntil = (condition) => new Promise((resolve) => {
  const interval = setInterval(() => {
    if (!condition()) {
      return;
    }

    clearInterval(interval);
    resolve();
  }, pollInterval);
});

module.exports = {
  waitUntil,
  pollInterval,
};
