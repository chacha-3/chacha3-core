const debug = require('debug')('transaction:model');

const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Chain = require('../models/chain');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');

const actions = {};

actions.createTransaction = {
  permission: 'authOnly',
  schema: {
    properties: {
      key: { type: 'string', buffer: 'hex' },
      address: { type: 'string', buffer: 'hex' },
      amount: { type: 'string' },
      password: { type: 'string' },
      type: { type: 'string' },
    },
    required: ['key', 'address', 'amount', 'password'],
  },
  preValidation: async (options) => {
    let selectedWallet;

    // Set selected wallet private key if default wallet has been selected
    if (!options.key && (selectedWallet = await Wallet.getSelected())) {
      const wallet = await Wallet.load(selectedWallet);

      // eslint-disable-next-line no-param-reassign
      options.key = wallet.getPrivateKeyHex();
    }
  },
  handler: async (options) => {
    const senderWallet = await Wallet.recover(options.key, options.password);

    if (!senderWallet) {
      return errorResponse(ErrorCode.PermissionDenied, 'Incorrect password');
    }

    const senderBalance = Chain.mainChain.getAccountBalance(senderWallet.getAddress());
    const amount = BigInt(options.amount);

    if (amount > senderBalance) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Insufficient sender balance');
    }

    const transaction = new Transaction(
      senderWallet.getPublicKey(),
      options.address,
      amount,
      options.type,
    );

    await transaction.sign(senderWallet.getPrivateKey(), options.password);

    // TODO: Validate before verify
    const errors = transaction.validate();

    if (errors.length > 0) {
      return errorResponse(ErrorCode.InvalidArgument, 'Invalid transaction', errors);
    }

    await transaction.saveAsPending();
    Peer.broadcastAction('pushTransaction', transaction.toPushData());

    return okResponse(transaction.toObject(), 'Transaction created');
  },
};

actions.pushTransaction = {
  permission: 'public',
  schema: {
    properties: {
      key: { type: 'string', buffer: 'hex' },
      address: { type: 'string', buffer: 'hex' },
      amount: { type: 'string' },
      signature: { type: 'string', buffer: 'hex' },
      time: { type: 'integer' },
      version: { type: 'integer' },
    },
    required: ['key', 'address', 'amount', 'signature', 'time', 'version'],
  },
  handler: async (options) => {
    const transaction = new Transaction(
      options.key,
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.setTime(options.time);
    transaction.setSignature(options.signature);
    transaction.setVersion(options.version);

    const errors = transaction.validate();

    if (errors.length > 0) {
      return errorResponse(ErrorCode.InvalidArgument, 'Invalid transaction', errors);
    }

    if (!transaction.verify()) {
      debug(`Transaction failed verification: ${JSON.stringify(options)}`);
      // TODO: Check if this error code appropriate
      return errorResponse(ErrorCode.InvalidArgument, 'Transaction failed verification');
    }

    await transaction.saveAsPending();
    debug('Add to pending transaction');

    return okResponse(transaction.toObject(), 'Transaction pushed');
  },
};

actions.pendingTransactions = {
  permission: 'public',
  handler: async () => {
    const transactions = await Transaction.loadPending();
    const data = transactions.map((transaction) => transaction.toObject());

    return okResponse(data, 'Pending transactions');
  },
};

actions.clearPendingTransactions = {
  permission: 'public',
  handler: async () => {
    await Transaction.clearAllPending();
    return okResponse(null, 'Cleared pending transactions');
  },
};

actions.transactionInfo = {
  permission: 'public',
  schema: {
    properties: {
      id: { type: 'string', buffer: 'hex' },
    },
    required: ['id'],
  },
  handler: async (options) => {
    const transaction = await Transaction.load(options.id);

    if (!transaction) {
      return errorResponse(ErrorCode.NotFound, 'Transaction ID not found');
    }

    return okResponse(transaction.toObject(), 'Transaction Info');
  },
};

module.exports = actions;
