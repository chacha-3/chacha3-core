const debug = require('debug')('transaction:model');

const Block = require('../models/block');
const Chain = require('../models/chain');
const Peer = require('../models/peer');
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
// const { serializeBuffers } = require('../util/serialize');

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
    const block = new Block();

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
    const block = await Block.load(Buffer.from(options.hash, 'hex'));

    if (!block) {
      return errorResponse(ErrorCode.NotFound, 'Block not found');
    }

    return okResponse(block.toObject(), 'Block Info');
  },
};

module.exports = actions;
