const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

const DB = require('../util/database');

// const addressPrefix = '420_';

class Wallet {
  static get AddressPrefix() {
    return '';
  }

  constructor() {
    this.label = '';

    this.privateKey = null;
    this.publicKey = null;
  }

  generate() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der',
        // cipher: "aes-256-cbc",
        // passphrase: 'qwe',
      },
    });

    this.privateKey = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });
    this.publicKey = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
  }

  getKeys() {
    assert(this.privateKey != null && this.publicKey != null);
    return { privateKey: this.privateKey, publicKey: this.publicKey };
  }

  getKeysPem() {
    const { privateKey, publicKey } = this.getKeys();

    return {
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }),
    };
  }

  getKeysBuffer() {
    const { privateKey, publicKey } = this.getKeys();

    return {
      privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }),
      publicKey: publicKey.export({ format: 'der', type: 'spki' }),
    };
  }

  getKeysHex() {
    const { publicKey, privateKey } = this.getKeysBuffer();

    return {
      privateKey: privateKey.toString('hex'),
      publicKey: publicKey.toString('hex'),
    };
  }

  getAddress() {
    const version = Buffer.from([0x00]);
    const { publicKey } = this.getKeysBuffer();

    const fingerprint = crypto.createHash('SHA3-256').update(publicKey).digest().slice(-20);
    const checksum = crypto.createHash('SHA3-256').update(fingerprint).digest().slice(-4);

    return Buffer.concat([version, fingerprint, checksum]);
  }

  getAddressEncoded(publicKey) {
    return `${Wallet.AddressPrefix}${bs58.encode(this.getAddress(publicKey))}`;
  }

  async save() {
    const { privateKey } = this.getKeysHex();

    const data = {
      label: this.label,
      privateKey,
    };

    const address = this.getAddressEncoded();
    await DB.put('wallet', address, JSON.stringify(data));
  }

  async load(address) {
    const result = await DB.get('wallet', address);

    const data = JSON.parse(result);
    this.label = data.label;

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(data.privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });

    this.recover(privateKey);
  }

  // async saveIndex() {
  //   let indexList;

  //   try {
  //     indexList = await DB.get('wallet', 'index');
  //   } catch (e) {
  //     indexList = [];
  //   }

  //   const address = this.getAddressEncoded();
  //   indexList.push(address);

  //   await DB.put('wallet', 'index', indexList);
  // }

  recover(privateKey) {
    this.privateKey = privateKey;
    this.publicKey = crypto.createPublicKey(this.privateKey);
  }
}

module.exports = Wallet;
