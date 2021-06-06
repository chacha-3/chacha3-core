const crypto = require('crypto');
const BN = require('bn.js');

const minTarget = {
  'production'  : '0000ff0000000000000000000000000000000000000000000000000000000000',
  'development' : '0000ff0000000000000000000000000000000000000000000000000000000000',
  'test'        : '00ff000000000000000000000000000000000000000000000000000000000000',
};

class Header {
  constructor() {
    this.version = 1;

    this.previous = null;
    this.merkleRoot = crypto.randomBytes(32); // TODO:

    this.time = Date.now();
    
    this.difficulty = 1;
    this.nonce = 0;
  }

  hashData() {
    const data = {
      version: this.version,
      previous: this.previous ? this.previous.toString('hex') : null,
      merkleRoot: this.merkleRoot ? this.merkleRoot.toString('hex') : null,
      time: this.time,
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

  getDifficulty() {
    return this.difficulty;
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
  }

  getTarget() {
    const target = new BN(this.getMinTarget(), 16);

    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(this.difficulty, 0);

    const difficulty = new BN(buf.toString('hex'), 16);
    return target.div(difficulty).toString(16, 32);
  }

  getMinTarget() {
    const env = process.env.NODE_ENV || 'development';
    return minTarget[env];
  }

  incrementNonce() {
    this.nonce += 1;
  }

  
}

module.exports = Header;