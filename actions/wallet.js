const Wallet = require('../models/wallet');

const wallet = {};

wallet.listWallets = async (request) => {
  const wallets = await Wallet.all();

  return { data: 'response' };
};

module.exports = wallet;
