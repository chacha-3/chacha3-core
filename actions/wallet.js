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

    Wallet.save(wallet);

    const data = {
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
      address: wallet.getAddressEncoded(),
      label: wallet.getLabel(),
    };

    return { data, code: 'ok' };
  },
};

actions.generateWallet = {
  permission: 'public',
  handler: async (options) => {
    const wallet = new Wallet();
    wallet.generate();
    // wallet.save();

    const data = {
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
      address: wallet.getAddressEncoded(),
    };

    return { data, code: 'ok' };
  },
};

actions.removeWallet = {
  permission: 'public',
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return { error: 'Wallet not found', code: 'not_found' };
    }

    const data = {
      address: wallet.getAddressEncoded(),
    };

    return { data, code: 'ok' };
  },
};

module.exports = actions;
