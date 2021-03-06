const Wallet = require('../models/wallet');
const Chain = require('../models/chain');

const { okResponse, ErrorCode, errorResponse } = require('../util/rpc');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');
const Transaction = require('../models/transaction');

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
      password: {
        type: 'string',
        validator: 'passwordStrength',
      },
    },
    required: ['label', 'password'],
  },
  handler: async (options) => {
    const wallet = new Wallet();
    await wallet.generate(options.password);
    await wallet.setLabel(options.label);

    Wallet.save(wallet);

    return okResponse(wallet.toObject(), 'Create wallet');
  },
};

// For utility only
actions.generateWallet = {
  permission: 'public',
  schema: {
    properties: {
      password: {
        type: 'string',
        validator: 'passwordStrength',
      },
    },
    required: ['password'],
  },
  handler: async (options) => {
    const wallet = new Wallet();
    await wallet.generate(options.password);

    const data = {
      address: wallet.getAddress(),
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
      privateKey: { type: 'string', buffer: 'hex' },
      label: { type: 'string' },
      password: { type: 'string' },
    },
    required: ['privateKey', 'label', 'password'],
  },
  handler: async (options) => {
    let wallet;

    try {
      wallet = await Wallet.recover(options.privateKey, options.password);
      wallet.setLabel(options.label);

      await Wallet.save(wallet);
    } catch (e) {
      // TODO: Check error type
      return errorResponse(ErrorCode.InvalidArgument, 'Unable to recover wallet');
    }

    const data = {
      label: wallet.getLabel(),
      address: wallet.getAddress(),
      privateKey: wallet.getPrivateKeyHex(),
      publicKey: wallet.getPublicKeyHex(),
    };

    return okResponse(data, 'Recover wallet');
  },
};

actions.changeWalletPassword = {
  permission: 'authOnly',
  schema: {
    properties: {
      address: { type: 'string', buffer: 'hex' },
      currentPassword: { type: 'string' },
      newPassword: { type: 'string' },
    },
    required: ['address', 'currentPassword', 'newPassword'],
  },
  preValidation: async (options) => {
    let selectedWallet;

    if (!options.address && (selectedWallet = await Wallet.getSelected())) {
      // eslint-disable-next-line no-param-reassign
      options.address = serializeBuffer(selectedWallet);
    }
  },
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return errorResponse(ErrorCode.NotFound, 'Wallet not found');
    }

    const changed = await wallet.changePassword(options.currentPassword, options.newPassword);

    if (!changed) {
      return errorResponse(ErrorCode.InvalidArgument, 'Unable to change wallet password');
    }

    await Wallet.save(wallet);
    return okResponse(wallet.toObject(), 'Update wallet password');
  },
};

actions.verifyWallet = {
  permission: 'authOnly',
  schema: {
    properties: {
      address: { type: 'string', buffer: 'hex' },
      password: { type: 'string' },
    },
    required: ['password', 'address'],
  },
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return errorResponse(ErrorCode.NotFound, 'Wallet not found');
    }

    const loaded = await Wallet.recover(wallet.getPrivateKey(), options.password);

    const data = {
      password: loaded !== null,
    };

    return okResponse(data, 'Verify wallet');
  },
};

actions.deleteWallet = {
  permission: 'authOnly',
  schema: {
    properties: {
      address: { type: 'string', buffer: 'hex' },
    },
    required: ['address'],
  },
  handler: async (options) => {
    const wallet = await Wallet.load(options.address);

    if (!wallet) {
      return errorResponse(ErrorCode.NotFound, 'Wallet not found');
    }

    await Wallet.delete(wallet.getAddress());

    const data = {
      address: wallet.getAddress(),
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
      address: { type: 'string', buffer: 'hex' },
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
      selected: serializeBuffer(selected),
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
  handler: async () => {
    const key = await Wallet.getSelected();
    const wallet = await Wallet.load(key);

    if (!wallet) {
      return errorResponse(ErrorCode.NotFound, 'No selected wallet');
    }

    const data = {
      label: wallet.getLabel(),
      address: serializeBuffer(key),
    };

    return okResponse(data, 'Wallet');
  },
};

actions.accountBalance = {
  permission: 'public',
  schema: {
    properties: {
      address: { type: 'string', buffer: 'hex' },
    },
    required: ['address'],
  },
  preValidation: async (options) => {
    let selectedWallet;

    if (!options.address && (selectedWallet = await Wallet.getSelected())) {
      // eslint-disable-next-line no-param-reassign
      options.address = serializeBuffer(selectedWallet);
    }
  },
  handler: async (options) => {
    const chain = Chain.mainChain;

    const data = {
      balance: chain.getAccountBalance(options.address),
    };

    return okResponse(data, 'Account balance');
  },
};

// TODO: Move to account action?
actions.accountTransactions = {
  permission: 'public',
  schema: {
    properties: {
      address: { type: 'string', buffer: 'hex' },
    },
    required: ['address'],
  },
  preValidation: async (options) => {
    let selectedWallet;

    if (!options.address && (selectedWallet = await Wallet.getSelected())) {
      // eslint-disable-next-line no-param-reassign
      options.address = serializeBuffer(selectedWallet);
    }
  },
  handler: async (options) => {
    const chain = Chain.mainChain;

    const txMapList = chain.getAccountTransactions(options.address);
    // const data = [];

    const loadTransaction = (txMap) => new Promise((resolve) => {
      const key = deserializeBuffer(txMap.id);

      Transaction.load(key).then((transaction) => {
        resolve(Object.assign(txMap, transaction.toObject()));
      });
    });

    const promises = txMapList.map((txMap) => loadTransaction(txMap));
    const transactions = await Promise.all(promises);

    // const data = transactions.map((t) => t.toObject());
    return okResponse(transactions, 'Account transactions');
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
