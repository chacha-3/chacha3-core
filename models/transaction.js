const assert = require('assert');
const crypto = require('crypto');
const bs58 = require('bs58');

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

  sign(privateKey) {
    assert(this.senderKey != null);
    this.signature = crypto.sign('SHA3-256', Buffer.from(this.hashData()), privateKey);
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
      return crypto.verify('SHA3-256', Buffer.from(this.hashData()), senderKeyObject, this.getSignature());
    } catch {
      return false;
    }
  }

  toObject() {
    const data = {
      version: this.version,
      senderKey: this.senderKey,
      receiverAddress: this.receiverAddress,
      amount: this.amount,
      signature: this.getSignature(),
    };

    return data;
  }
}

module.exports = Transaction;
