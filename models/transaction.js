const assert = require('assert');
const crypto = require('crypto');

const Wallet = require('./wallet');

const { WalletDB, TransactionDB } = require('../util/db');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress; // FIXME: Change to use buffer?

    this.amount = amount;

    assert.strictEqual(amount > 0, true);

    this.signature = null;
  }

  hashData() {
    const data = {
      version: this.version,
      receiverAddress: this.receiverAddress, // Base54
      amount: this.amount,
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

  getAmount() {
    return this.amount;
  }

  getSignature() {
    return this.signature;
  }

  verify() {
    if (!Wallet.verifyAddress(this.receiverAddress)) {
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
    const data = {
      id: this.getId().toString('hex'),
      version: this.version,
      senderKey: null,
      receiverAddress: this.receiverAddress,
      amount: this.amount,
      signature: null,
    };

    if (this.senderKey) {
      data.senderKey = this.getSenderKey().toString('hex');
    }

    if (this.signature) {
      data.signature = this.getSignature().toString('hex');
    }

    return data;
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
      return false;
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

module.exports = Transaction;
