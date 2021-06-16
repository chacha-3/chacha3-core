const Wallet = require('../models/wallet');

const actions = {};

actions.listWallets = async (request) => {
  const wallets = await Wallet.all();

  const data = [];
  wallets.forEach((wallet) => data.push(wallet.toObject()));

  return { data };
};

module.exports = actions;
