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

  generate(password) {
    const passphrase = password || '';

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der',
        cipher: 'aes-256-cbc',
        passphrase,
      },
    });

    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  getLabel() {
    return this.label;
  }

  setLabel(label) {
    this.label = label || '';
  }

  getKeys(password) {
    assert(this.privateKey != null && this.publicKey != null);
    const passphrase = password || '';

    const privateKey = crypto.createPrivateKey({
      key: this.privateKey, format: 'der', type: 'pkcs8', passphrase,
    });

    const publicKey = crypto.createPublicKey({
      key: this.publicKey, format: 'der', type: 'spki',
    });

    return { privateKey, publicKey };
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPublicKeyObject() {
    assert(this.publicKey != null);

    return crypto.createPublicKey({
      key: this.publicKey, format: 'der', type: 'spki',
    });
  }

  getPrivateKeyObject(password) {
    assert(this.privateKey != null);
    const passphrase = password || '';

    return crypto.createPrivateKey({
      key: this.privateKey, format: 'der', type: 'pkcs8', passphrase,
    });
  }

  // TODO: Remove, not in use
  // getKeysPem() {
  //   // const { privateKey, publicKey } = this.getKeys();

  //   return {
  //     privateKey: this.privateKey.export({ format: 'pem', type: 'pkcs8' }),
  //     publicKey: this.publicKey.export({ format: 'pem', type: 'spki' }),
  //   };
  // }

  getKeysBuffer() {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
    };
  }

  getKeysHex() {
    // const { publicKey, privateKey } = this.getKeysBuffer();

    return {
      privateKey: this.privateKey.toString('hex'),
      publicKey: this.publicKey.toString('hex'),
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

  toSaveData() {
    const { privateKey, publicKey } = this.getKeysHex();

    return {
      label: this.label,
      privateKey,
      publicKey,
    };
  }

  fromSaveData(data, password) {
    const passphrase = password || '';

    this.setLabel(data.label);

    this.privateKey = Buffer.from(data.privateKey, 'hex');
    this.publicKey = Buffer.from(data.publicKey, 'hex');

    // this.recover(crypto.createPrivateKey({
    //   key: Buffer.from(data.privateKey, 'hex'),
    //   format: 'der',
    //   type: 'pkcs8',
    //   passphrase,
    // }));
  }

  async save() {
    const address = this.getAddressEncoded();
    await WalletDB.put(address, this.toSaveData(), { valueEncoding: 'json' });
  }

  async load(address) {
    let data;

    try {
      data = await WalletDB.get(address, { valueEncoding: 'json' });
    } catch (e) {
      return false;
    }

    this.fromSaveData(data);

    return true;
  }

  async delete() {
    WalletDB.del(this.getAddressEncoded());
  }

  recover(privateKey) {
    // this.privateKey = privateKey;
    this.publicKey = crypto.createPublicKey(this.privateKey);
  }

  toObject() {
    const { privateKey, publicKey } = this.getKeysHex();

    const data = {
      label: this.label,
      privateKey,
      publicKey,
      address: this.getAddressEncoded(),
    };

    return data;
  }

  fromObject(data) {
    this.setLabel(data.label);
    // this.setKeys(Buffer.from(data.privateKey, 'hex'), Buffer.from(data.publicKey, 'hex'));
    this.privateKey = Buffer.from(data.privateKey, 'hex');
    this.publicKey = Buffer.from(data.publicKey, 'hex');
  }

  toString() {
    const data = this.toObject();
    data.address = this.getAddressEncoded();

    return JSON.stringify(data, null, 2);
  }
}

module.exports = Wallet;
