const debug = require('debug')('transaction:model');

const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');

const actions = {};

actions.createTransaction = {
  permission: 'public', // TODO: Change to private
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
    const senderWallet = Wallet.recover(Buffer.from(options.key, 'hex'));

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

    Transaction.addPending(transaction);

    Peer.broadcastAction({
      action: 'pushTransaction',
      key: transaction.getSenderKey().toString('hex'),
      address: transaction.getReceiverAddress(),
      amount: transaction.getAmount(),
      signature: transaction.getSignature().toString('hex'),
      time: transaction.getTime(),
    });

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
    },
    required: ['key', 'address', 'amount', 'signature', 'time'],
  },
  handler: async (options) => {
    const transaction = new Transaction(
      Buffer.from(options.key, 'hex'),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.setTime(options.time);
    transaction.setSignature(Buffer.from(options.signature, 'hex'));

    const errors = transaction.validate();

    if (errors.length > 0) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Invalid transaction', errors);
    }

    if (!transaction.verify()) {
      debug(`Transaction failed verification: ${JSON.stringify(options)}`);
      return errorResponse(ErrorCode.FailedPrecondition, 'Transaction failed verification');
    }

    Transaction.addPending(transaction);
    debug('Add to pending transaction');

    return okResponse(transaction.toObject(), 'Transaction pushed');
  },
};

actions.pendingTransactions = {
  permission: 'public',
  handler: async () => {
    const transactions = Transaction.pendingList;
    const data = transactions.map((transaction) => transaction.toObject());

    return okResponse(data, 'Pending transactions');
  },
};

module.exports = actions;
