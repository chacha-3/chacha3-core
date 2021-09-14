const debug = require('debug')('transaction:model');

const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
const { deserializeBuffer } = require('../util/serialize');

const actions = {};

actions.createTransaction = {
  permission: 'authOnly',
  schema: {
    properties: {
      key: { type: 'string' },
      address: { type: 'string' },
      amount: { type: 'string' },
      password: { type: 'string' },
    },
    required: ['key', 'address', 'amount'],
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
    const senderWallet = Wallet.recover(deserializeBuffer(options.key));

    const transaction = new Transaction(
      senderWallet.getPublicKey(),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.sign(senderWallet.getPrivateKeyObject(options.password));

    const errors = transaction.validate();

    if (errors.length > 0) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Invalid transaction', errors);
    }

    await Transaction.save(transaction, true);
    Peer.broadcastAction('pushTransaction', transaction.toPushData());

    return okResponse(transaction.toObject(), 'Transaction created');
  },
};

actions.pushTransaction = {
  permission: 'public',
  schema: {
    properties: {
      key: { type: 'string' },
      address: { type: 'string' },
      amount: { type: 'string' },
      signature: { type: 'string' },
      time: { type: 'integer' },
      version: { type: 'integer' },
    },
    required: ['key', 'address', 'amount', 'signature', 'time', 'version'],
  },
  handler: async (options) => {
    const transaction = new Transaction(
      deserializeBuffer(options.key),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.setTime(options.time);
    transaction.setSignature(deserializeBuffer(options.signature));
    transaction.setVersion(options.version);

    const errors = transaction.validate();

    if (errors.length > 0) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Invalid transaction', errors);
    }

    if (!transaction.verify()) {
      debug(`Transaction failed verification: ${JSON.stringify(options)}`);
      return errorResponse(ErrorCode.FailedPrecondition, 'Transaction failed verification');
    }

    await Transaction.save(transaction, true);
    debug('Add to pending transaction');

    return okResponse(transaction.toObject(), 'Transaction pushed');
  },
};

actions.pendingTransactions = {
  permission: 'public',
  handler: async () => {
    const transactions = await Transaction.loadPending();
    // console.log(transactions);
    const data = transactions.map((transaction) => transaction.toObject());

    return okResponse(data, 'Pending transactions');
  },
};

actions.clearPendingTransactions = {
  permission: 'public',
  handler: async () => {
    // const transactions = await Transaction.loadPending();
    // console.log(transactions);
    // const data = transactions.map((transaction) => transaction.toObject());

    await Transaction.clearAllPending();
    return okResponse(null, 'Cleared pending transactions');
  },
};

actions.transactionInfo = {
  permission: 'public',
  schema: {
    properties: {
      id: { type: 'string' },
    },
    required: ['id'],
  },
  handler: async (options) => {
    const transaction = await Transaction.load(deserializeBuffer(options.id));

    if (!transaction) {
      return errorResponse(ErrorCode.NotFound, 'Transaction ID not found');
    }

    return okResponse(transaction.toObject(), 'Transaction Info');
  },
};

module.exports = actions;
