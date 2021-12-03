const Wallet = require('../models/wallet');
const Miner = require('../models/miner');

const { errorResponse, ErrorCode, okResponse } = require('../util/rpc');
const { serializeBuffer } = require('../util/serialize');

const actions = {};

const miner = new Miner();

actions.startMiner = {
  permission: 'authOnly', // TODO: Change to private
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
  handler: (options) => {
    if (miner.isMining()) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Miner already running');
    }

    miner.setReceiverAddress(options.address);
    miner.start();

    const data = {
      address: options.address,
    };

    return okResponse(data, 'Running miner');
  },
};

actions.stopMiner = {
  permission: 'authOnly', // TODO: Change to private
  handler: async () => {
    if (!miner.isMining()) {
      return errorResponse(ErrorCode.FailedPrecondition, 'Miner is not running');
    }

    miner.stop();

    const data = {
      address: miner.getReceiverAddress(),
    };

    return okResponse(data, 'Stopped miner');
  },
};

actions.minerStatus = {
  permission: 'authOnly',
  handler: async () => {
    const data = {
      isMining: miner.isMining(),
    };

    if (miner.isMining()) {
      data.address = miner.getReceiverAddress();
    }

    return okResponse(data, 'Miner status');
  },
};

module.exports = actions;
