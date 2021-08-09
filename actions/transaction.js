// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const actions = {};

actions.createTransaction = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   key: {
  //     required: true,
  //     type: 'hex',
  //   },
  // },
  handler: async (options) => {
    const senderWallet = Wallet.recover(Buffer.from(options.key, 'hex'));

    const transaction = new Transaction(
      senderWallet.getPublicKey(),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.sign(senderWallet.getPrivateKeyObject(options.password));
    transaction.verify(); // TODO: See if required

    const data = {
      id: transaction.getId().toString('hex'),
      version: transaction.version,
      senderKey: null,
      receiverAddress: transaction.receiverAddress,
      amount: transaction.amount,
      signature: null,
    };

    if (transaction.senderKey) {
      data.senderKey = transaction.getSenderKey().toString('hex');
    }

    if (transaction.signature) {
      data.signature = transaction.getSignature().toString('hex');
    }

    return { data, code: 'ok', message: 'Transaction created' };
  },
};

module.exports = actions;
