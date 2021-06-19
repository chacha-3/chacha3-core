const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

// const DB = require('../util/database');
const { WalletDB } = require('../util/db');

// const addressPrefix = '420_';

class Wallet {
  static get AddressPrefix() {
    return '';
  }

  static async all() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      WalletDB
        .createValueStream({ valueEncoding: 'json' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadWallet = (data) => new Promise((resolve) => {
      const wallet = new Wallet();
      wallet.fromObject(data);

      resolve(wallet);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadWallet(value)));
    return Promise.all(promises);
  }

  static async clearAll() {
    await WalletDB.clear();
  }

  static async setSelected(wallet) {
    if (wallet == null) {
      await WalletDB.del('selected');
      return;
    }

    await WalletDB.put('selected', wallet.getAddressEncoded());
  }

  static async getSelected() {
    let address;

    try {
      address = await WalletDB.get('selected');
    } catch (e) {
      return null;
    }

    const wallet = new Wallet();
    await wallet.load(address);

    return wallet;
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

    this.setKeys(privateKey, publicKey);
  }

  setKeys(privateKey, publicKey) {
    this.privateKey = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });
    this.publicKey = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
  }

  getLabel() {
    return this.label;
  }

  setLabel(label) {
    this.label = label;
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
    const address = this.getAddressEncoded();
    await WalletDB.put(address, this.toObject(), { valueEncoding: 'json' });
  }

  async load(address) {
    let data;

    try {
      data = await WalletDB.get(address, { valueEncoding: 'json' });
    } catch (e) {
      return false;
    }

    this.setLabel(data.label);

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(data.privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });

    this.recover(privateKey);
    return true;
  }

  async delete() {
    WalletDB.del(this.getAddressEncoded());
  }

  recover(privateKey) {
    this.privateKey = privateKey;
    this.publicKey = crypto.createPublicKey(this.privateKey);
  }

  toObject() {
    const { privateKey, publicKey } = this.getKeysHex();

    const data = {
      label: this.label,
      privateKey,
      publicKey,
    };

    return data;
  }

  fromObject(data) {
    this.setLabel(data.label);
    this.setKeys(Buffer.from(data.privateKey, 'hex'), Buffer.from(data.publicKey, 'hex'));
  }
}

module.exports = Wallet;
