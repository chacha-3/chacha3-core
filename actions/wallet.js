const Wallet = require('../models/wallet');

const actions = {};

actions.listWallets = {
  permission: 'public',
  handler: async () => {
    const wallets = await Wallet.all();

    const data = [];
    wallets.forEach((wallet) => data.push(wallet.toObject()));

    return { data, code: 'ok', message: 'Wallet list' };
  },
};

actions.createWallet = {
  permission: 'public',
  schema: {
    properties: {
      label: { type: 'string' },
    },
  },
  handler: async (options) => {
    const wallet = new Wallet();
    wallet.generate();
    wallet.setLabel(options.label);

    Wallet.save(wallet);

    const data = {
      label: wallet.getLabel(),
      address: wallet.getAddressEncoded(),
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
    };

    return { data, code: 'ok', message: 'Create wallet' };
  },
};

actions.generateWallet = {
  permission: 'public',
  handler: async () => {
    const wallet = new Wallet();
    wallet.generate();
    // wallet.save();

    const data = {
      address: wallet.getAddressEncoded(),
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
    };

    return { data, code: 'ok', message: 'Generate Wallet' };
  },
};

actions.recoverWallet = {
  permission: 'public',
  schema: {
    properties: {
      privateKey: { type: 'string' },
      label: { type: 'string' },
    },
    required: ['privateKey'],
  },
  handler: async (options) => {
    let wallet;

    try {
      wallet = Wallet.recover(Buffer.from(options.privateKey, 'hex'));
      wallet.setLabel(options.label);

      await Wallet.save(wallet);
    } catch (e) {
      return { error: 'Could not recover wallet', code: 'fail' };
    }

    const data = {
      label: wallet.getLabel(),
      address: wallet.getAddressEncoded(),
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
    };

    return { data, code: 'ok', message: 'Recover wallet' };
  },
};

actions.deleteWallet = {
  permission: 'public',
  schema: {
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return { error: 'Wallet not found', code: 'not_found' };
    }

    await Wallet.delete(wallet.getAddressEncoded());

    const data = {
      address: wallet.getAddressEncoded(),
    };

    return { data, code: 'ok', message: 'Delete wallet' };
  },
};

actions.deleteAllWallets = {
  permission: 'auth',
  handler: async () => {
    await Wallet.clearAll();

    const data = {};
    return { data, code: 'ok', message: 'Deleted all saved wallets' };
  },
};

module.exports = actions;
