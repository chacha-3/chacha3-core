const crypto = require('crypto');

class Header {
  constructor() {
    this.version = 1;

    this.hashPrevBlock = crypto.randomBytes(32);
    // this.hashMerkleRoot = crypto.randomBytes(32);

    this.time = Date.now();
    this.difficulty = 1;
    this.nonce = 0;
  }
  preHash() {
    const buf = Buffer.allocUnsafe(80);
    buf.writeUInt32BE(this.version, 0);

    this.hashPrevBlock.copy(buf, 4, 0, 32);
    this.hashMerkleRoot.copy(buf, 36, 0, 32);
    buf.writeUInt32BE(this.time / 1000, 68);
    buf.writeUInt32BE(this.difficulty, 72);
    buf.writeUInt32BE(this.nonce, 76);

    return buf;
  }

  getHash() {
    const pass1 = crypto.createHash('sha256').update(this.preHash()).digest();
    const pass2 = crypto.createHash('sha256').update(pass1).digest();
  
    return pass2;
  }
}

module.exports = Header;