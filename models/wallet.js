const crypto = require('crypto');
const assert = require('assert');
const debug = require('debug')('wallet:model');

const argon2 = require('argon2');
const XXHash = require('xxhash');

// const DB = require('../util/database');
const { WalletDB, DB } = require('../util/db');
const { serializeBuffer, deserializeBuffer } = require('../util/serialize');

// const addressPrefix = '420_';

class Wallet {
  constructor() {
    this.label = '';

    this.privateKey = null; // Encrypted
    this.publicKey = null;
  }

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

  static checksumHash(fingerprint) {
    return XXHash.hash(fingerprint, 0xe782cbe4, 'buffer').slice(-4);
  }

  static generateAddress(publicKey) {
    const version = Buffer.from([0x00]);

    const fingerprint = crypto.createHash('SHA3-256').update(publicKey).digest().slice(-20);
    const checksum = Wallet.checksumHash(fingerprint);

    return Buffer.concat([version, fingerprint, checksum]);
  }

  // TODO: Remove. Use generateAddress
  static generateAddressEncoded(publicKey) {
    // return `${Wallet.AddressPrefix}${bs58.encode(Wallet.generateAddress(publicKey))}`;
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

  // static privateKeyEncodingOptions(passphrase) {
  //   return {
  //     type: 'pkcs8',
  //     format: 'der',
  //     cipher: 'aes-256-cbc',
  //     passphrase,
  //   };
  // }

  static async deriveEncryptionKey(password, salt) {
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
    };

    if (process.env.NODE_ENV === 'test') {
      Object.assign(options, testOptions);
    }

    const key = await argon2.hash(password, options);

    return key;
  }

  static async encryptPrivateKey(privateKey, password) {
    const version = Buffer.from([0x01]);

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

    if (version !== 0x01) {
      throw Error('Wallet version not supported');
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

  // TODO: Remove use
  getPublicKeyHex() {
    assert(this.privateKey !== null);

    return serializeBuffer(this.publicKey);
  }

  // TODO: Remove use
  getPrivateKeyHex() {
    assert(this.privateKey !== null);

    return serializeBuffer(this.privateKey);
  }

  // getPublicKeyObject() {
  //   return crypto.createPublicKey({
  //     key: this.publicKey, format: 'der', type: 'spki',
  //   });
  // }

  // getPrivateKeyObject(password) {
  //   const passphrase = password || '';

  //   return crypto.createPrivateKey({
  //     key: this.privateKey, format: 'der', type: 'pkcs8', passphrase,
  //   });
  // }

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

  // static hashOptions(version = 0x01, salt) {
  //   return {
  //     raw: true,
  //     salt,
  //     hashLength: 32,
  //     saltLength: 16,
  //     timeCost: 42,
  //     memoryCost: 2 ** 16,
  //     parallelism: 8,
  //   };
  // }

  // TODO: Remove default blank pass
  async changePassword(currentPassword = '', newPassword) {
    let privateKeyObject;

    const decrypted = await Wallet.decryptPrivateKey(this.getPrivateKey(), currentPassword);

    if (decrypted == null) {
      return false;
    }

    // TODO: Remove try catch as using custom decryption now
    try {
      privateKeyObject = crypto.createPrivateKey({
        key: decrypted, format: 'der', type: 'pkcs8',
      });
    } catch (e) {
      return false;
    }

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

    let privateKeyObject;

    const decrypted = await Wallet.decryptPrivateKey(encryptedPrivateKey, password);

    if (decrypted == null) {
      return null;
    }

    // Remove try catch as using custom encryption
    try {
      privateKeyObject = crypto.createPrivateKey({
        key: decrypted, format: 'der', type: 'pkcs8',
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
