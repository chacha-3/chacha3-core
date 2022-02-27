const debug = require('debug')('transaction:action');
const assert = require('assert');

const Block = require('../models/block');
const Chain = require('../models/chain');
const Transaction = require('../models/transaction');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
const { serializeBuffer } = require('../util/serialize');

const actions = {};

actions.pushBlock = {
  permission: 'public',
  schema: {
    properties: {
      header: {
        type: 'object',
        properties: {
          hash: { type: 'string', buffer: 'hex' },
          previous: { type: 'string', buffer: 'hex' },
          time: { type: 'integer' },
          difficulty: { type: 'integer' },
          checksum: { type: 'string', buffer: 'hex' },
          version: { type: 'integer' },
          a: { type: 'integer' },
          x: { type: 'integer' },
          y: { type: 'integer' },
          z: { type: 'integer' },
        },
      },
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', buffer: 'hex' },
            senderKey: { type: 'string', buffer: 'hex', nullable: true },
            receiverAddress: { type: 'string', buffer: 'hex' },
            amount: { type: 'string' },
            version: { type: 'integer' },
            time: { type: 'integer' },
            signature: { type: 'string', buffer: 'hex', nullable: true },
            type: { type: 'string' },
          },
        },
      },
    },
  },
  handler: async (options) => {
    const block = Block.fromObject(options);
    debug(`Receive new block: ${serializeBuffer(block.getHeader().getHash())}`);

    const result = await Chain.mainChain.confirmNewBlock(block);

    if (!result) {
      return errorResponse(
        ErrorCode.InvalidArgument,
        'Could not accept new block. Either invalid of does not match latest block',
      );
    }

    await block.save();
    await Chain.mainChain.save();

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
    properties: {
      offset: { type: 'integer' },
      limit: { type: 'integer' },
      order: { type: 'string' },
    },
  },
  handler: async (options) => {
    const chain = Chain.mainChain;

    const { offset, limit, order } = options;

    const start = offset;
    const end = (limit === undefined) ? limit : limit + (start || 0);

    let headers = chain.blockHeaders;

    if (order === 'desc') {
      headers = headers.reverse();
    }

    const data = headers.slice(start, end).map((header) => header.toObject());
    return okResponse(data, 'Block list');
  },
};

// TODO: Change permission to API only, non-ipc
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

    if (!block) {
      return errorResponse(ErrorCode.NotFound, 'Block not found');
    }

    assert(block !== null);

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
