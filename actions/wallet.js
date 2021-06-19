const Wallet = require('../models/wallet');

const actions = {};

actions.listWallets = {
  permission: 'public',
  handler: async (requestData) => {
    const wallets = await Wallet.all();

    const data = [];
    wallets.forEach((wallet) => data.push(wallet.toObject()));

    return [data, 200];
  },
};

module.exports = actions;
