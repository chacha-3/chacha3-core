const assert = require('assert');
const crypto = require('crypto');

const Wallet = require('./wallet');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress;

    this.amount = amount;

    assert.strictEqual(amount > 0, true);

    this.signature = null;
  }

  hashData() {
    const data = {
      version: this.version,
      receiverAddress: this.receiverAddress,
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
}

module.exports = Transaction;
