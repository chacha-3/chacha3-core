const crypto = require('crypto');
const bs58 = require('bs58');
const assert = require('assert');

// const DB = require('../util/database');
const { WalletDB, DB } = require('../util/db');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');

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
      wallet.fromSaveData(data);

      resolve(wallet);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadWallet(value)));
    return Promise.all(promises);
  }

  static async clearAll() {
    await Wallet.setSelected(null);
    await WalletDB.clear();
  }

  static generateAddress(publicKey) {
    const version = Buffer.from([0x00]);

    const fingerprint = crypto.createHash('SHA3-256').update(publicKey).digest().slice(-20);
    const checksum = crypto.createHash('SHA3-256').update(fingerprint).digest().slice(-4);

    return Buffer.concat([version, fingerprint, checksum]);
  }

  static generateAddressEncoded(publicKey) {
    // return `${Wallet.AddressPrefix}${bs58.encode(Wallet.generateAddress(publicKey))}`;
    return serializeBuffer(Wallet.generateAddress(publicKey));
  }

  static verifyAddress(address) {
    if (address.length !== 25) {
      return false;
    }

    const fingerprint = address.slice(1, 21);
    const checksum = crypto.createHash('SHA3-256').update(fingerprint).digest().slice(-4);

    return address.slice(21, 25).equals(checksum);
  }

  static async setSelected(address) {
    if (address === null) {
      DB.del('selectedWallet');
      return true;
    }

    const wallet = await Wallet.load(address);

    if (wallet) {
      await DB.put('selectedWallet', wallet.getAddressEncoded());
      return true;
    }

    return false;
  }

  static async getSelected() {
    let selected;

    try {
      selected = await DB.get('selectedWallet');
    } catch (e) {
      return null;
    }

    return deserializeBuffer(selected);
  }

  constructor() {
    this.label = '';

    this.privateKey = null;
    this.publicKey = null;
  }

  generate(password) {
    assert(this.privateKey === null);
    assert(this.publicKey === null);

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

  getPrivateKey() {
    return this.privateKey;
  }

  setPrivateKey(privateKey) {
    this.privateKey = privateKey;
  }

  getPublicKey() {
    return this.publicKey;
  }

  setPublicKey(publicKey) {
    this.publicKey = publicKey;
  }

  getPublicKeyHex() {
    assert(this.privateKey !== null);

    return serializeBuffer(this.publicKey);
  }

  getPrivateKeyHex() {
    assert(this.privateKey !== null);

    return serializeBuffer(this.privateKey);
  }

  getPublicKeyObject() {
    return crypto.createPublicKey({
      key: this.publicKey, format: 'der', type: 'spki',
    });
  }

  getPrivateKeyObject(password) {
    const passphrase = password || '';

    return crypto.createPrivateKey({
      key: this.privateKey, format: 'der', type: 'pkcs8', passphrase,
    });
  }

  getAddress() {
    assert(this.publicKey != null);
    return Wallet.generateAddress(this.publicKey);
  }

  getAddressEncoded() {
    assert(this.publicKey != null);
    return Wallet.generateAddressEncoded(this.publicKey);
  }

  toSaveData() {
    return {
      label: this.label,
      privateKey: this.getPrivateKeyHex(),
      publicKey: this.getPublicKeyHex(),
    };
  }

  fromSaveData(data) {
    this.setLabel(data.label);

    this.privateKey = deserializeBuffer(data.privateKey);
    this.publicKey = deserializeBuffer(data.publicKey);
  }

  static async save(wallet) {
    await WalletDB.put(wallet.getAddress(), wallet.toSaveData(), { valueEncoding: 'json' });
  }

  static async load(address) {
    let data;

    try {
      data = await WalletDB.get(address, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const wallet = new Wallet();
    wallet.fromSaveData(data);

    return wallet;
  }

  static async delete(address) {
    assert(address !== null);

    const selected = await Wallet.getSelected();

    if (selected && address.equals(selected)) {
      await Wallet.setSelected(null);
    }

    await WalletDB.del(address);
  }

  static recover(privateKey, password) {
    const passphrase = password || '';

    const wallet = new Wallet();
    wallet.setPrivateKey(privateKey);

    let privateKeyObject;

    try {
      privateKeyObject = crypto.createPrivateKey({
        key: privateKey, format: 'der', type: 'pkcs8', passphrase,
      });
    } catch (e) {
      return null;
    }

    const publicKey = crypto.createPublicKey(privateKeyObject).export(
      { format: 'der', type: 'spki' },
    );

    wallet.setPublicKey(publicKey);
    return wallet;
  }

  toObject() {
    const data = {
      label: this.label,
      privateKey: this.getPrivateKeyHex(),
      publicKey: this.getPublicKeyHex(),
      address: this.getAddressEncoded(),
    };

    return data;
  }
}

module.exports = Wallet;
