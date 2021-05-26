const crypto = require('crypto');
const bs58 = require('bs58');

class Wallet {
  constructor() {
    this.generateKeyPair();
  }

  generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der',
      },
    });

    this.privateKey = crypto.createPrivateKey({key: privateKey, format: 'der', type: 'pkcs8'});
    this.publicKey = crypto.createPublicKey({key: publicKey, format: 'der', type: 'spki'});
  }

  getKeys() {
    return { privateKey: this.privateKey, publicKey: this.publicKey };
  }

  getKeysPem() {
    return {
      privateKey: this.privateKey.export({ format: 'pem', type: 'pkcs8'}),
      publicKey: this.publicKey.export({ format: 'pem', type: 'spki'}),
    }
  }

  getKeysBuffer() {
    return {
      privateKey: this.privateKey.export({ format: 'der', type: 'pkcs8'}),
      publicKey: this.publicKey.export({ format: 'der', type: 'spki'}),
    }
  }

  getAddress() {
    const version = Buffer.from([ 0x00 ]);
    let fingerprint, checksum;

    const { publicKey } = this.getKeysPem();

    fingerprint = crypto.createHash('sha256').update(publicKey).digest();
    fingerprint = crypto.createHash('ripemd160').update(fingerprint).digest();

    checksum = crypto.createHash('sha256').update(fingerprint).digest();
    checksum = crypto.createHash('sha256').update(checksum).digest();

    return Buffer.concat([version, fingerprint, checksum.slice(0, 4)]);
  }

  getAddressEncoded(publicKey) {
    return bs58.encode(this.getAddress(publicKey))
  }
}

module.exports = Wallet;