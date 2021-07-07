const assert = require('assert');
const crypto = require('crypto');
const bs58 = require('bs58');

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
      receiverAddress: bs58.encode(this.receiverAddress),
      amount: this.amount,
    };

    if (this.senderKey) {
      // FIXME: Encode with hex
      data.senderKey = bs58.encode(this.senderKey);
    }

    return JSON.stringify(data);
  }

  sign(privateKey) {
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
    const senderKeyObject = crypto.createPublicKey({
      key: this.getSenderKey(), format: 'der', type: 'spki',
    });

    try {
      return crypto.verify('SHA3-256', Buffer.from(this.hashData()), senderKeyObject, this.getSignature());
    } catch {
      return false;
    }
  }
}

module.exports = Transaction;
