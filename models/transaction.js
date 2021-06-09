const assert  = require('assert');
const crypto = require('crypto');
const bs58 = require('bs58');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    // assert.strictEqual(receiver.length, 120);
 
    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress;

    this.amount = 0;
    // this.fee = 0;
  
    this.signature = null;
  }
  
  hashData() {
    const data = {
      version: this.version,
      receiverAddress: bs58.encode(this.receiverAddress),
      amount: this.amount,
    }

    if (this.senderKey) {
      data.senderKey = bs58.encode(this.senderKey.export({ format: 'der', type: 'spki'}));
    }

    return JSON.stringify(data);
  }

  sign(privateKey) {
    this.signature = crypto.sign('SHA3-256', Buffer.from(this.hashData()), privateKey);
  }

  getSender() {
    return this.senderKey;
  }

  getReceiverAddress() {
    return this.receiverAddress;
  }

  getSignature() {
    return this.signature;
  }

  verify() {
    assert.notStrictEqual(this.signature, null);

    try {
      return crypto.verify('SHA3-256', Buffer.from(this.hashData()), this.senderKey, this.signature);
    } catch {
      return false;
    }
  }
}

module.exports = Transaction;