const Wallet = require('../models/wallet');

const actions = {};

actions.listWallets = {
  permission: 'public',
  handler: async () => {
    const wallets = await Wallet.all();

    const data = [];
    wallets.forEach((wallet) => data.push(wallet.toObject()));

    return { data, code: 'ok' };
  },
};

actions.createWallet = {
  permission: 'public',
  handler: async (options) => {
    const wallet = new Wallet();
    wallet.generate();
    wallet.setLabel(options.label);
    wallet.save();

    return { data: wallet.toObject(), code: 'ok' };
  },
};

actions.generateWallet = {
  permission: 'public',
  handler: async (options) => {
    const wallet = new Wallet();
    wallet.generate();
    // wallet.save();

    return { data: wallet.toObject(), code: 'ok' };
  },
};

module.exports = actions;
