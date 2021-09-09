const Wallet = require('../models/wallet');
const { okResponse, ErrorCode, errorResponse } = require('../util/rpc');

const actions = {};

actions.listWallets = {
  permission: 'authOnly',
  handler: async () => {
    const wallets = await Wallet.all();

    const data = [];
    wallets.forEach((wallet) => data.push(wallet.toObject()));

    return okResponse(data, 'Wallet list');
  },
};

actions.createWallet = {
  permission: 'authOnly',
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

    return okResponse(data, 'Create wallet');
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

    return okResponse(data, 'Generate Wallet');
  },
};

actions.recoverWallet = {
  permission: 'authOnly',
  schema: {
    properties: {
      privateKey: { type: 'string' },
      label: { type: 'string' },
      password: { type: 'string' },
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
      // TODO: Check error type
      return errorResponse(ErrorCode.InvalidArgument, 'Unable to recover wallet');
    }

    const data = {
      label: wallet.getLabel(),
      address: wallet.getAddressEncoded(),
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
    };

    return okResponse(data, 'Recover wallet');
  },
};

actions.deleteWallet = {
  permission: 'authOnly',
  schema: {
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return errorResponse(ErrorCode.NotFound, 'Wallet not found');
    }

    await Wallet.delete(wallet.getAddressEncoded());

    const data = {
      address: wallet.getAddressEncoded(),
    };

    return okResponse(data, 'Delete wallet');
  },
};

actions.deleteAllWallets = {
  permission: 'authOnly',
  handler: async () => {
    await Wallet.clearAll();

    return okResponse(null, 'Deleted all saved wallets');
  },
};

actions.selectWallet = {
  permission: 'public',
  schema: {
    properties: {
      address: { type: 'string' },
    },
    required: ['address'],
  },
  handler: async (options) => {
    const result = await Wallet.setSelected(options.address);

    if (!result) {
      return errorResponse(ErrorCode.NotFound, 'Wallet not found');
    }

    const selected = await Wallet.getSelected();

    const data = {
      selected,
    };

    return okResponse(data, 'Wallet');
  },
};

actions.unselectWallet = {
  permission: 'public',
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  //   required: ['address'],
  // },
  handler: async () => {
    await Wallet.setSelected(null);

    const data = {
      selected: null,
    };

    return okResponse(data, 'Wallet');
  },
};

actions.selectedWallet = {
  permission: 'public',
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  //   required: ['address'],
  // },
  handler: async () => {
    const selected = await Wallet.getSelected();

    const data = {
      selected,
    };

    return okResponse(data, 'Wallet');
  },
};

// actions.walletInfo = {
//   permission: 'public',
//   schema: {
//     properties: {
//       address: { type: 'string' },
//     },
//   },
//   handler: async (options) => {
//     await Wallet.setSelected(null);

//     let { address } = options;

//     if (!address) {
//       address = await Wallet.getSelected();
//     }

//     const data = {
//       selected: null,
//     };

//     return { data, code: 'ok', message: 'Wallet info' };
//   },
// };

module.exports = actions;
