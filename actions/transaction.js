// const bs58 = require('bs58');
// const { option } = require('yargs');

const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');

const actions = {};

actions.createTransaction = {
  permission: 'public', // TODO: Change to private
  schema: {
    properties: {
      key: { type: 'string' },
      address: { type: 'string' },
      amount: { type: 'string' },
      password: { type: 'string' },
    },
    required: ['key', 'address', 'amount'],
  },
  preValidation: async (options) => {
    let selectedWallet;

    if (!options.key && (selectedWallet = await Wallet.getSelected())) {
      const wallet = await Wallet.load(selectedWallet);

      // eslint-disable-next-line no-param-reassign
      options.key = wallet.getPrivateKeyHex();
    }
  },
  handler: async (options) => {
    const senderWallet = Wallet.recover(Buffer.from(options.key, 'hex'));

    const transaction = new Transaction(
      senderWallet.getPublicKey(),
      options.address,
      Number.parseInt(options.amount, 10),
    );

    transaction.sign(senderWallet.getPrivateKeyObject(options.password));
    // transaction.verify(); // TODO: See if required

    const { valid, errors } = transaction.validate();

    if (!valid) {
      return { code: 'failed_precondition', message: 'Invalid transaction', errors };
    }

    Transaction.addPending(transaction);

    // const data = {
    //   id: transaction.getId().toString('hex'),
    //   // version: transaction.version,
    //   sender: null,
    //   receiver: transaction.receiverAddress,
    //   amount: transaction.amount,
    //   signature: null,
    // };

    // if (transaction.senderKey) {
    //   // data.sender = transaction.getSenderKey().toString('hex');
    //   data.sender = Wallet.generateAddressEncoded(transaction.getSenderKey());
    // }

    // if (transaction.signature) {
    //   data.signature = transaction.getSignature().toString('hex');
    // }

    return { data: transaction.toObject(), code: 'ok', message: 'Transaction created' };
  },
};

actions.pendingTransactions = {
  permission: 'public', // TODO: Change to private
  // schema: {
  //   properties: {
  //     key: { type: 'string' },
  //     address: { type: 'string' },
  //     amount: { type: 'string' },
  //     password: { type: 'string' },
  //   },
  //   required: ['key', 'address', 'amount'],
  // },
  handler: async () => {
    const transactions = Transaction.pendingList;
    const data = transactions.map((transaction) => transaction.toObject());

    return { data, code: 'ok', message: 'Pending transactions' };
  },
};

module.exports = actions;
