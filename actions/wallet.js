const Wallet = require('../models/wallet');

const actions = {};

actions.listWallets = {
  permission: 'public',
  handler: async (requestData) => {
    const wallets = await Wallet.all();

    const data = [];
    wallets.forEach((wallet) => data.push(wallet.toObject()));

    return { data, code: 'ok' };
  },
};

module.exports = actions;
