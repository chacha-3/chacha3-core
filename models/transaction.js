const crypto = require('crypto');

class Transaction {
  constructor() {
    this.version = 1;

    this.amount = 0;
    this.fee = 0;

    this.sender = crypto.randomBytes(44);
    this.receiverAddress = crypto.randomBytes(25);

    // this.hash = crypto.randomBytes(32);
    this.previousHash = crypto.randomBytes(32);
    this.signature = crypto.randomBytes(32);
  }
  hashData() {
    const data = {
      version: this.version,
      amount: this.amount,
      fee: this.fee,
      sender: this.sender,
      receiverAddress: this.receiverAddress,
      previousHash: this.previousHash,
    }

    return JSON.stringify(data);
  }

  sign(privateKey) {
    this.signature = crypto.sign("sha256", Buffer.from(this.hashData()), privateKey);
  }

  getHash() {
    const pass1 = crypto.createHash('sha256').update(this.preHash()).digest();
    const pass2 = crypto.createHash('sha256').update(pass1).digest();
  
    return pass2;
  }
}

module.exports = Transaction;