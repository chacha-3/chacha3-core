const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

const DB = require('../util/database');

// const addressPrefix = '420_';

// class WalletList {
//   static items = [];

//   static async loadItems() {
//     WalletList.index = await DB.get('wallet', 'index') || [];
//   }

//   static async saveItems() {
//     await DB.put('wallet', 'index', Wallet.index);
//   }

//   static async clearItems() {
//     await DB.del('wallet', 'index');
//     WalletList.index = [];
//   }

//   static addItem(key) {
//     Wallet.loadIndex();

//     if (Wallet.index.indexOf(key) === -1) {
//       Wallet.index.push(key);
//     }

//     Wallet.saveIndex();
//   }

//   static async removeIndex(key) {
//     Wallet.loadIndex();
//     const i = Wallet.index.indexOf(key);

//     if (i > -1) {
//       Wallet.index.splice(i, 1);
//     }

//     await DB.put(itemName, 'index', JSON.stringify(list));
//   }

// }

class Wallet {
  static get AddressPrefix() {
    return '';
  }

  static index = [];

  static async loadIndex() {
    // Wallet.index = await DB.index('wallet');
    Wallet.index = await DB.get('wallet', 'index') || [];
  }

  static async saveIndex() {
    await DB.put('wallet', 'index', Wallet.index);
  }

  static async clearIndex() {
    await DB.del('wallet', 'index');
    Wallet.index = [];
  }

  static addIndex(key) {
    Wallet.loadIndex();

    if (Wallet.index.indexOf(key) === -1) {
      Wallet.index.push(key);
    }

    Wallet.saveIndex();
  }

  static async removeIndex(key) {
    Wallet.loadIndex();
    const i = Wallet.index.indexOf(key);

    if (i > -1) {
      Wallet.index.splice(i, 1);
    }

    await DB.put(itemName, 'index', JSON.stringify(list));
  }

  static async listAll() {
    await Wallet.loadIndex();
    const promises = [];

    const loadWallet = (i) => new Promise((resolve) => {
      const wallet = new Wallet();

      wallet.load(Wallet.index[i]).then(() => {
        resolve(wallet);
      });
    });

    for (let i = 0; i < Wallet.index.length; i += 1) {
      promises.push(loadWallet(i));
    }

    return Promise.all(promises);
  }

  static async deleteAll() {
    // const index = await DB.index('wallet', 'index');
    await Wallet.loadIndex();

    for (let i = 0; i < Wallet.index.length; i += 1) {
      DB.del('wallet', Wallet.index[i]);
    }

    await DB.del('wallet', 'index');
    Wallet.index = [];
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
    const { privateKey } = this.getKeysHex();

    const data = {
      label: this.label,
      privateKey,
    };

    const address = this.getAddressEncoded();
    await DB.put('wallet', address, JSON.stringify(data));
    
    // await DB.addIndex('wallet', address);

    console.log(`Saved ${this.getAddressEncoded()}`);
  }

  async load(address) {
    const data = await DB.get('wallet', address);

    if (!data) {
      return false;
    }

    this.label = data.label;

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(data.privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });

    this.recover(privateKey);

    return true;
  }

  async delete() {
    await DB.del('wallet', this.getAddressEncoded());
    // await DB.removeIndex('wallet', this.getAddressEncoded()); FIXME:
  }

  recover(privateKey) {
    this.privateKey = privateKey;
    this.publicKey = crypto.createPublicKey(this.privateKey);
  }
}

module.exports = Wallet;
