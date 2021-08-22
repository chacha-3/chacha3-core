const debug = require('debug')('transaction:model');

const Block = require('../models/block');
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
    const block = new Block();


    return okResponse(block.toObject(), 'Block pushed');
  },
};

module.exports = actions;
