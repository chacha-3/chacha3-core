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

actions.createWallet = {
  permission: 'public',
  handler: async (requestData) => {
    const wallet = new Wallet();
    wallet.generate();
    wallet.setLabel(requestData.label);
    wallet.save();

    return { data: wallet.toObject(), code: 'ok' };
  },
};

module.exports = actions;
