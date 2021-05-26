const assert  = require('assert');
const crypto = require('crypto');

class Transaction {
  constructor(sender, receiver, amount, fee) {
    this.version = 1;

    assert.strictEqual(receiver.length, 84);
 
    this.sender = sender;
    this.receiver = receiver;

    this.amount = 0;
    this.fee = 0;

    this.hash = crypto.randomBytes(32);
    this.previous = crypto.randomBytes(32);
  
    this.signature = null;
  }
  
  hashData() {
    const data = {
      version: this.version,
      amount: this.amount,
      fee: this.fee,
      sender: this.sender,
      receiver: this.receiver,
      previous: this.previous,
    }

    return JSON.stringify(data);
  }

  sign(key) {  
    this.signature = crypto.sign('sha256', Buffer.from(this.hashData()), key);
  }

  getSignature() {
    return this.signature;
  }

  verify() {
    assert.notStrictEqual(this.signature, null);

    const key = crypto.createPublicKey({ key: this.sender, format: 'der', type: 'spki'});
    return crypto.verify('sha256', Buffer.from(this.hashData()), key, this.signature);
  }

  // getHash() {
  //   const pass1 = crypto.createHash('sha256').update(this.hashData()).digest();
  //   const pass2 = crypto.createHash('sha256').update(pass1).digest();
  
  //   return pass2;
  // }
}

module.exports = Transaction;