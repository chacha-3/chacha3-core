const assert  = require('assert');
const crypto = require('crypto');
const bs58 = require('bs58');

class Transaction {
  constructor(sender, receiver, amount) {
    this.version = 1;

    // assert.strictEqual(receiver.length, 120);
 
    this.sender = sender;
    this.receiver = receiver;

    this.amount = 0;
    // this.fee = 0;
  
    this.signature = null;
  }
  
  hashData() {
    const data = {
      version: this.version,
      sender: bs58.encode(this.sender.export({ format: 'der', type: 'spki'})),
      receiver: bs58.encode(this.receiver.export({ format: 'der', type: 'spki'})),
      amount: this.amount,
    }
    // console.log(JSON.stringify(data, null, 2));
    return JSON.stringify(data);
  }

  sign(senderKey) {
    this.signature = crypto.sign('SHA3-224', Buffer.from(this.hashData()), senderKey);
  }

  getSender() {
    return this.sender;
  }

  getReceiver() {
    return this.receiver;
  }

  getSignature() {
    return this.signature;
  }

  verify() {
    assert.notStrictEqual(this.signature, null);

    try {
      return crypto.verify('SHA3-224', Buffer.from(this.hashData()), this.sender, this.signature);
    } catch {
      return false;
    }
  }
}

module.exports = Transaction;