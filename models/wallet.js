const crypto = require('crypto');
const assert = require('assert');
const debug = require('debug')('wallet:model');

const argon2 = require('argon2');
const XXHash = require('xxhash');

// const DB = require('../util/database');
const { WalletDB, DB } = require('../util/db');
const { isTestEnvironment } = require('../util/env');

const {
  serializeBuffer,
  deserializeBuffer,
  unpackObject,
  packObject,
} = require('../util/serialize');

class Wallet {
  constructor() {
    this.label = '';

    this.privateKey = null; // Encrypted
    this.publicKey = null;
  }

  static async all() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      WalletDB
        .createValueStream({ valueEncoding: 'binary' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadWallet = (data) => new Promise((resolve) => {
      const wallet = new Wallet();
      wallet.fromSaveData(unpackObject(data));

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

  static checksumHash(fingerprint) {
    return XXHash.hash(fingerprint, 0xe782cbe4, 'buffer').slice(-4);
  }

  static generateAddress(publicKey) {
    const version = Buffer.from([0x00]);

    const fingerprint = crypto.createHash('SHA3-256').update(publicKey).digest().slice(-20);
    const checksum = Wallet.checksumHash(fingerprint);

    return Buffer.concat([version, fingerprint, checksum]);
  }

  static generateAddressEncoded(publicKey) {
    return serializeBuffer(Wallet.generateAddress(publicKey));
  }

  static verifyAddress(address) {
    if (address.length !== 25) {
      return false;
    }

    const fingerprint = address.slice(1, 21);
    const checksum = Wallet.checksumHash(fingerprint);

    return address.slice(21, 25).equals(checksum);
  }

  static async setSelected(address) {
    if (address === null) {
      DB.del('selectedWallet');
      return true;
    }

    const wallet = await Wallet.load(address);

    if (wallet) {
      await DB.put('selectedWallet', wallet.getAddress(), {
        valueEncoding: 'binary',
      });
      return true;
    }

    return false;
  }

  static async getSelected() {
    let selected;

    try {
      selected = await DB.get('selectedWallet', { valueEncoding: 'binary' });
    } catch (e) {
      return null;
    }

    return selected;
  }

  static async deriveEncryptionKey(password, salt) {
    // Lower rounds to speed up test
    const testOptions = {
      parallelism: 1,
      timeCost: 2,
      memoryCost: 1024,
    };

    const options = {
      parallelism: 8,
      timeCost: 40,
      memoryCost: 2 ** 16,
      salt,
      hashLength: 32,
      raw: true,
      type: argon2.argon2i,
    };

    if (isTestEnvironment) {
      Object.assign(options, testOptions);
    }

    const key = await argon2.hash(password, options);

    return key;
  }

  static async encryptPrivateKey(privateKey, password) {
    const version = Buffer.from([0x00]);

    const iv = crypto.randomBytes(12);
    const salt = crypto.randomBytes(16);

    const key = await this.deriveEncryptionKey(password, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes for GCM

    return Buffer.concat([version, salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
  }

  static async decryptPrivateKey(encryptedBuffer, password) {
    const version = encryptedBuffer[0];

    if (version !== 0x00) {
      throw Error('Invalid wallet or wallet version not supported');
    }

    const salt = encryptedBuffer.slice(1, 17);

    const key = await this.deriveEncryptionKey(password, salt);
    const iv = encryptedBuffer.slice(17, 29);
    const authTag = encryptedBuffer.slice(29, 45);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const data = encryptedBuffer.slice(45);

    try {
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted;
    } catch (e) {
      return null;
    }
  }

  async generate(password = '') {
    assert(this.privateKey === null);
    assert(this.publicKey === null);

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

    this.privateKey = await Wallet.encryptPrivateKey(privateKey, password);
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
    await WalletDB.put(wallet.getAddress(), packObject(wallet.toSaveData()), {
      keyEncoding: 'binary',
      valueEncoding: 'binary',
    });
  }

  static async load(address) {
    let data;

    try {
      data = await WalletDB.get(address, { keyEncoding: 'binary', valueEncoding: 'binary' });
    } catch (e) {
      return null;
    }

    const wallet = new Wallet();
    wallet.fromSaveData(unpackObject(data));

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

  // TODO: Remove default blank pass
  async changePassword(currentPassword = '', newPassword) {
    const decrypted = await Wallet.decryptPrivateKey(this.getPrivateKey(), currentPassword);

    if (decrypted == null) {
      return false;
    }

    // TODO: Handle error for possibly corrupted/invalid decrypted key. Edge case.
    const privateKeyObject = crypto.createPrivateKey({
      key: decrypted, format: 'der', type: 'pkcs8',
    });

    const newPrivateKey = privateKeyObject.export({
      type: 'pkcs8',
      format: 'der',
    });

    const encrypted = await Wallet.encryptPrivateKey(newPrivateKey, newPassword);
    this.setPrivateKey(encrypted);

    return true;
  }

  static async recover(encryptedPrivateKey, password = '') {
    const wallet = new Wallet();
    wallet.setPrivateKey(encryptedPrivateKey);

    let decrypted = null;

    try {
      decrypted = await Wallet.decryptPrivateKey(encryptedPrivateKey, password);
    } catch (e) {
      return null;
    }

    if (decrypted == null) {
      return null;
    }

    // TODO: Handle error for possibly corrupted/invalid decrypted key. Edge case.
    const privateKeyObject = crypto.createPrivateKey({
      key: decrypted, format: 'der', type: 'pkcs8',
    });

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
