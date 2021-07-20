// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const actions = {};

actions.createTransaction = {
  permission: 'public', // TODO: Change to private
  handler: async (options) => {
    const senderWallet = new Wallet();
    senderWallet.recover(Buffer.from(options.key, 'hex'));

    const transaction = new Transaction(
      senderWallet.getPublicKey(),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.sign(senderWallet.getPrivateKeyObject(options.password));
    transaction.verify(); // TODO: See if required

    return { data: transaction.toObject(), code: 'ok' };
  },
};

module.exports = actions;