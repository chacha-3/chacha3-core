const waitUntil = (condition) => new Promise((resolve) => {
  // Lower for testing to speed up
  // TODO: Testing
  const pollInterval = process.env.NODE_ENV === 'test' ? 5 : 100;

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
};
