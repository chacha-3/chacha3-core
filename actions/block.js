const debug = require('debug')('transaction:model');

const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');

const actions = {};

actions.pushBlock = {
  permission: 'public',
  // schema: {
  //   properties: {
  //     key: { type: 'string' },
  //     address: { type: 'string' },
  //     amount: { type: 'string' },
  //     signature: { type: 'string' },
  //     time: { type: 'integer' },
  //     version: { type: 'integer' },
  //   },
  //   required: ['key', 'address', 'amount', 'signature', 'time', 'version'],
  // },
  handler: async (options) => {
    const transaction = new Transaction(
      Buffer.from(options.key, 'hex'),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.setTime(options.time);
    transaction.setSignature(Buffer.from(options.signature, 'hex'));
    transaction.setVersion(options.version);

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

module.exports = actions;
