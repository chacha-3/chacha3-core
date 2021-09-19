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
  schema: {
    properties: {
      header: {
        type: 'object',
        properties: {
          hash: { type: 'string', buffer: 'hex' },
          previous: { type: 'string', buffer: 'hex' },
          time: { type: 'integer' },
          difficulty: { type: 'integer' },
          nonce: { type: 'integer' },
          checksum: { type: 'string', buffer: 'hex' },
          version: { type: 'integer' },
        },
      },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', buffer: 'hex' },
            sender: { type: 'string', buffer: 'hex', nullable: true },
            receiver: { type: 'string', buffer: 'hex' },
            amount: { type: 'integer' },
            version: { type: 'integer' },
            time: { type: 'integer' },
            signature: { type: 'string', buffer: 'hex', nullable: true },
          },
        },
      },
    },
  },
  handler: async (options) => {
    const block = Block.fromObject(options);
    debug(`Receive new block: ${serializeBuffer(block.getHeader().getHash())}`);

    // TODO: Verify balances
    const result = await Chain.mainChain.confirmNewBlock(block);

    if (!result) {
      return errorResponse(
        ErrorCode.InvalidArgument,
        'Could not accept new block. Either invalid of does not match latest block',
      );
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
      hash: { type: 'string', buffer: 'hex' },
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
      hash: { type: 'string', buffer: 'hex' },
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
