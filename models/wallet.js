const crypto = require('crypto');
const bs58 = require('bs58');

class Wallet {
  constructor() {
    this.generateKeyPair();
  }

  generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'sect239k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  getAddress() {
    const version = Buffer.from([ 0x00 ]);
    let fingerprint, checksum;
    console.log(crypto.createPrivateKey({key: this.privateKey, format: 'pem'}).export({format: 'der', type: 'pkcs8'}));
    fingerprint = crypto.createHash('sha256').update(this.publicKey).digest();
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