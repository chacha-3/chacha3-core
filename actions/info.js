// const bs58 = require('bs58');
// const { option } = require('yargs');
const os = require('os');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const Chain = require('../models/chain');
const Miner = require('../models/miner');

const actions = {};

const miner = new Miner();

function networkIPs() {
  return Object.values(os.networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat((i.family === 'IPv4' && !i.internal && i.address) || []), [])), []);
}

actions.nodeInfo = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   properties: {
  //     address: { type: 'string' },
  //   },
  //   required: ['address'],
  // },
  handler: async () => {
    const chain = await Chain.load();

    const data = {
      version: process.env.npm_package_version,
      time: Date.now(),
      listening: process.env.PORT || 0,
      length: chain.getLength(),
    };

    return { data, code: 'ok', message: 'Info' };
  },
};

module.exports = actions;
