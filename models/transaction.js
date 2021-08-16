const assert = require('assert');
const crypto = require('crypto');

const Wallet = require('./wallet');

const { serializeBuffer } = require('../util/serialize');
const { TransactionDB } = require('../util/db');
const { generateAddressEncoded } = require('./wallet');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress; // FIXME: Change to use buffer?

    this.amount = amount;

    assert.strictEqual(amount > 0, true);

    this.signature = null;
    this.time = Date.now();
  }

  // static pendingList = [];

  hashData() {
    const data = {
      version: this.version,
      receiverAddress: this.receiverAddress, // Base54
      amount: this.amount,
      time: this.time,
    };

    if (this.senderKey) {
      data.senderKey = this.senderKey.toString('hex');
    }

    return JSON.stringify(data);
  }

  getId() {
    return crypto.createHash('SHA256').update(Buffer.from(this.hashData())).digest();
  }

  getVersion() {
    return this.version;
  }

  sign(privateKey) {
    assert(this.senderKey != null);
    this.signature = crypto.sign('SHA256', Buffer.from(this.hashData()), privateKey);
  }

  getSenderKey() {
    return this.senderKey;
  }

  getReceiverAddress() {
    return this.receiverAddress;
  }

  getTime() {
    return this.time;
  }

  getAmount() {
    return this.amount;
  }

  getSignature() {
    return this.signature;
  }

  validate() {
    const senderAddress = Wallet.generateAddressEncoded(this.senderKey);

    const errors = [];

    if (this.receiverAddress === senderAddress) {
      errors.push('Same sender and receiver');
    }

    if (!Wallet.verifyAddress(this.receiverAddress)) {
      errors.push('Invalid receiver address');
    }

    if (this.amount <= 0) {
      errors.push('Amount has to be greater than 0');
    }

    return errors;
  }

  verify() {
    const errors = this.validate();

    if (errors.length > 0) {
      return false;
    }

    const senderKeyObject = crypto.createPublicKey({
      key: this.getSenderKey(), format: 'der', type: 'spki',
    });

    try {
      return crypto.verify('SHA256', Buffer.from(this.hashData()), senderKeyObject, this.getSignature());
    } catch {
      return false;
    }
  }

  toObject() {
    return {
      id: serializeBuffer(this.getId()),
      sender: generateAddressEncoded(this.getSenderKey()),
      receiver: this.getReceiverAddress(),
      amount: this.getAmount(),
      version: this.getVersion(),
      time: this.getTime(),
      signature: serializeBuffer(this.getSignature()),
    };
  }

  static async save(transaction) {
    assert(transaction.getId() != null);
    const key = transaction.getId();

    const data = {
      id: transaction.getId().toString('hex'),
      version: transaction.getVersion(),
      senderKey: transaction.getSenderKey() ? transaction.getSenderKey().toString('hex') : null,
      receiverAddress: transaction.getReceiverAddress(),
      amount: transaction.getAmount(),
      signature: transaction.getSignature() ? transaction.getSignature().toString('hex') : null,
    };

    await TransactionDB.put(key, data, { valueEncoding: 'json' });
    return { key, data };
  }

  static async load(id) {
    let data;

    try {
      data = await TransactionDB.get(id, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const loaded = new Transaction(
      (data.senderKey) ? Buffer.from(data.senderKey, 'hex') : null,
      data.receiverAddress,
      data.amount,
    );

    loaded.version = data.version;

    if (data.signature) {
      loaded.signature = Buffer.from(data.signature, 'hex');
    }

    return loaded;
  }

  static async clearAll() {
    await TransactionDB.clear();
  }
}

Transaction.pendingList = [];

Transaction.addPending = (transaction) => {
  const index = Transaction.pendingList.findIndex((t) => t.getId().equals(transaction.getId()));

  if (index === -1) {
    Transaction.pendingList.push(transaction);
  }
};

module.exports = Transaction;
