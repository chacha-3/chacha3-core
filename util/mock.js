const Wallet = require('../models/wallet');

const mock = {};

mock.createWallets = async (count) => {
  const createWallet = (i) => new Promise((resolve) => {
    const wallet = new Wallet();
    wallet.setLabel(`addWallet${i}`);
    wallet.generate();

    wallet.save().then(() => resolve(wallet));
  });

  const promises = [];
  for (let i = 0; i < count; i += 1) {
    promises.push(createWallet(i));
  }

  return Promise.all(promises);
};

module.exports = mock;
