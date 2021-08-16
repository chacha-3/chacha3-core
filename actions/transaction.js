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

    // Set selected wallet private key if default wallet has been selected
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

    const errors = transaction.validate();

    if (errors.length > 0) {
      return { code: 'failed_precondition', message: 'Invalid transaction', errors };
    }

    Transaction.addPending(transaction);

    return { data: transaction.toObject(), code: 'ok', message: 'Transaction created' };
  },
};

actions.pendingTransactions = {
  permission: 'public',
  handler: async () => {
    const transactions = Transaction.pendingList;
    const data = transactions.map((transaction) => transaction.toObject());

    return { data, code: 'ok', message: 'Pending transactions' };
  },
};

module.exports = actions;
