const assert  = require('assert');
const crypto = require('crypto');

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
      sender: this.sender.toString('hex'),
      receiver: this.receiver.toString('hex'),
      amount: this.amount,
    }

    return JSON.stringify(data);
  }

  sign(key) {
    this.signature = crypto.sign('SHA3-224', Buffer.from(this.hashData()), key);
  }

  getSignature() {
    return this.signature;
  }

  verify() {
    assert.notStrictEqual(this.signature, null);

    try {
      // const key = crypto.createPublicKey({ key: this.sender, format: 'der', type: 'spki'});
      return crypto.verify('SHA3-224', Buffer.from(this.hashData()), this.sender, this.signature);
    } catch {
      return false;
    }
  }
}

module.exports = Transaction;