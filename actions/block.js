const debug = require('debug')('transaction:model');
const assert = require('assert');

const Block = require('../models/block');
const Chain = require('../models/chain');
const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
const { serializeBuffer } = require('../util/serialize');

const actions = {};

actions.pushBlock = {
  permission: 'public',
  // TODO: Schema
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
    const block = Block.fromObject(options);

    if (!block.verify()) {
      return errorResponse(ErrorCode.InvalidArgument, 'Invalid block');
    }

    debug(`Receive new block: ${serializeBuffer(block.getHeader().getHash())}`);

    // TODO: Verify

    const added = Chain.mainChain.addBlockHeader(block.getHeader());

    if (!added) {
      debug('Unable to add new block. Chain is behind.');
      return errorResponse(ErrorCode.FailedPrecondition, 'Does not match latest block');
    }

    await block.save();

    for (let i = 0; i < block.getTransactionCount(); i += 1) {
      // Remove pending transactions, except coinbase
      if (block.getTransaction(i).getSenderKey()) {
        debug(`Clear pending transaction: ${serializeBuffer(block.getTransaction(i).getId())}`);
        Transaction.clear(block.getTransaction(i).getId(), true);
      }
    }

    return okResponse(block.toObject(), 'Block pushed');
  },
};

actions.listBlocks = {
  permission: 'public',
  schema: {
    // TODO: Filter
    properties: {
      startIndex: { type: 'integer' },
      endIndex: { type: 'integer' },
    },
  },
  handler: async (options) => {
    const chain = Chain.mainChain;
    const data = chain.blockHeaders.map((header) => header.toObject());

    return okResponse(data, 'Block list');
  },
};

actions.blockInfo = {
  permission: 'public',
  schema: {
    properties: {
      hash: { type: 'string' },
    },
    required: ['hash'],
  },
  handler: async (options) => {
    const block = await Block.load(options.hash);
    assert(block.verify());

    if (!block) {
      return errorResponse(ErrorCode.NotFound, 'Block not found');
    }

    return okResponse(block.toObject(), 'Block Info');
  },
};

actions.blockTransactions = {
  permission: 'public',
  schema: {
    properties: {
      hash: { type: 'string' },
    },
    required: ['hash'],
  },
  handler: async (options) => {
    const block = await Block.load(options.hash);

    if (!block) {
      return errorResponse(ErrorCode.NotFound, 'Block not found');
    }

    const transactions = block.getTransactions();
    const data = transactions.map((transaction) => transaction.toObject());

    return okResponse(data, 'Block transactions');
  },
};

module.exports = actions;
