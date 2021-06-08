const crypto = require('crypto');
const level = require('level');
const bs58 = require('bs58');

const db = level('wallets');

const addressPrefix = '420_';

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

  getKeysHex() {
    const { publicKey, privateKey } = this.getKeysBuffer();

    return {
      privateKey: privateKey.toString('hex'),
      publicKey: publicKey.toString('hex'),
    }
  }

  getAddress() {
    const version = Buffer.from([ 0x00 ]);
    let fingerprint, checksum;

    const { publicKey } = this.getKeysBuffer();

    fingerprint = crypto.createHash('SHA3-256').update(publicKey).digest();
    fingerprint = fingerprint.slice(-20);

    checksum = crypto.createHash('SHA3-256').update(fingerprint).digest();
    return Buffer.concat([version, fingerprint, checksum.slice(0, 4)]);
  }

  getAddressEncoded(publicKey) {
    return `${addressPrefix}${bs58.encode(this.getAddress(publicKey))}`;
  }

  load() {}

  save() {
    // console.log(this.getKeysHex());
    const { publicKey, privateKey } = this.getKeys();
    // console.log(publicKey);
    // console.log(this.publicKey.toString('hex'));
    // console.log(keys.privateKey, keys,this.publicKey)
    // db.put(keys.publicKey, JSON.stringify(keys), err => { throw err });
  }
}

module.exports = Wallet;