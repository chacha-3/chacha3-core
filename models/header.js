const crypto = require('crypto');

class Header {
  constructor() {
    this.version = 1;

    this.previous = null;
    this.merkleRoot = crypto.randomBytes(32); // TODO:

    this.time = Date.now() / 1000;
    
    this.difficulty = 1;
    this.nonce = 0;
  }

  hashData() {
    const data = {
      version: this.version,
      previous: this.previous ? this.previous.toString('hex') : null,
      merkleRoot: this.merkleRoot ? this.merkleRoot.toString('hex') : null,
      difficulty: this.difficulty,
      nonce: this.nonce,
    }

    return JSON.stringify(data);
  }


  getHash() {
    const pass1 = crypto.createHash('sha256').update(Buffer.from(this.hashData())).digest();
    const pass2 = crypto.createHash('sha256').update(pass1).digest();
  
    return pass2;
  }

  incrementNonce() {
    this.nonce += 1;
  }
}

module.exports = Header;