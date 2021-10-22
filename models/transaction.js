const assert = require('assert');
const crypto = require('crypto');

const debug = require('debug')('transaction:model');

const Wallet = require('./wallet');

const {
  serializeObject, deserializeObject, serializeBuffer, deserializeBuffer, deserializeBigInt,
} = require('../util/serialize');

const { TransactionDB, PendingTransactionDB } = require('../util/db');
const { generateAddressEncoded } = require('./wallet');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress; // FIXME: Change to use buffer?

    // assert.strictEqual(amount > 0, true);
    this.amount = (typeof (amount) === 'bigint') ? amount : BigInt(amount);

    this.signature = null;
    this.time = Date.now();
  }

  hashData() {
    const data = {
      version: this.version,
      receiverAddress: this.receiverAddress,
      amount: this.amount,
      time: this.time,
    };

    assert(typeof (data.amount) === 'bigint');
    assert(this.senderKey !== undefined);

    if (this.senderKey !== null) {
      data.senderKey = this.senderKey;
    }

    return JSON.stringify(serializeObject(data));
  }

  getId() {
    return crypto.createHash('SHA256').update(Buffer.from(this.hashData())).digest();
  }

  getIdHex() {
    return serializeBuffer(this.getId());
  }

  isCoinbase() {
    return this.getSenderKey() === null && this.getSignature() === null;
  }

  getVersion() {
    return this.version;
  }

  setVersion(version) {
    this.version = version;
  }

  sign(privateKey, password) {
    assert(this.senderKey != null);

    const passphrase = password || '';
    const keyObject = crypto.createPrivateKey({
      key: privateKey, format: 'der', type: 'pkcs8', passphrase,
    });

    this.signature = crypto.sign('SHA256', Buffer.from(this.hashData()), keyObject);
  }

  getSenderKey() {
    return this.senderKey;
  }

  getReceiverAddress() {
    return this.receiverAddress;
  }

  getTime() {
    return this.time;
  }

  setTime(time) {
    this.time = time;
  }

  getAmount() {
    return this.amount;
  }

  getSignature() {
    return this.signature;
  }

  setSignature(signature) {
    this.signature = signature;
  }

  validate() {
    const errors = [];

    if (this.senderKey) {
      const senderAddress = Wallet.generateAddress(this.senderKey);

      if (this.receiverAddress.equals(senderAddress)) {
        errors.push('Same sender and receiver');
      }
    }

    if (!Wallet.verifyAddress(this.receiverAddress)) {
      errors.push('Invalid receiver address');
    }

    if (this.amount <= 0n) {
      errors.push('Amount has to be more than 0');
    }

    return errors;
  }

  verify() {
    const errors = this.validate();

    if (!this.senderKey) {
      return true;
    }

    if (errors.length > 0) {
      debug(`Failed transaction verification: ${JSON.stringify(errors.length)}`);
      return false;
    }

    const senderKeyObject = crypto.createPublicKey({
      key: this.getSenderKey(), format: 'der', type: 'spki',
    });

    try {
      return crypto.verify('SHA256', Buffer.from(this.hashData()), senderKeyObject, this.getSignature());
    } catch {
      return false;
    }
  }

  static fromObject(data) {
    // const data = deserializeObject(obj);

    const transaction = new Transaction(
      deserializeBuffer(data.senderKey),
      deserializeBuffer(data.receiverAddress),
      deserializeBigInt(data.amount),
    );

    transaction.setVersion(data.version);
    transaction.setTime(data.time);
    transaction.setSignature(deserializeBuffer(data.signature));

    return transaction;
  }

  toObject() {
    const data = {
      id: this.getId(),
      version: this.getVersion(),
      senderKey: this.getSenderKey(),
      receiverAddress: this.getReceiverAddress(),
      amount: this.getAmount(),
      signature: this.getSignature(),
      time: this.getTime(),
    };

    return serializeObject(data);
  }

  toPushData() {
    assert(this.getSignature() !== null);

    return serializeObject({
      key: this.getSenderKey(),
      address: this.getReceiverAddress(),
      amount: this.getAmount(),
      version: this.getVersion(),
      time: this.getTime(),
      signature: this.getSignature(),
    });
  }

  // Use is saved
  // static async exist(key) {
  //   try {
  //     await TransactionDB.get(key);
  //     return true;
  //   } catch (e) {
  //     return false;
  //   }
  // }

  async saveAsPending() {
    assert(this.getId() != null);
    const key = this.getId();

    const exist = await this.isSaved();

    if (exist) {
      debug('Pending transaction is prior transaction. Ignored');
      return false;
    }

    debug('Pending transaction is not prior transaction. Continue save');
    await PendingTransactionDB.put(key, this.toObject(), { valueEncoding: 'json' });

    debug(`Saved pending transaction: ${serializeBuffer(key)}`);
    return true;
  }

  async save() {
    assert(this.getId() != null);
    const key = this.getId();

    await TransactionDB.put(key, this.toObject(), { valueEncoding: 'json' });
  }

  static toArray(transactions) {
    const data = [];

    for (let i = 0; i < transactions.length; i += 1) {
      data.push(transactions[i].toObject());
    }

    return data;
  }

  static fromArray(data) {
    const transactions = [];

    for (let i = 0; i < data.length; i += 1) {
      const transaction = Transaction.fromObject(data[i]);
      transactions.push(transaction);
    }

    return transactions;
  }

  async isSaved() {
    try {
      await TransactionDB.get(this.getId());
    } catch (e) {
      return false;
    }

    return true;
  }

  static async load(id) {
    let loaded;

    try {
      loaded = await TransactionDB.get(id, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    return Transaction.fromObject(loaded);
  }

  static async loadPending() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      PendingTransactionDB
        .createValueStream({ valueEncoding: 'json' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadTransaction = (data) => new Promise((resolve) => {
      const transaction = Transaction.fromObject(data);
      resolve(transaction);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadTransaction(value)));
    return Promise.all(promises);
  }

  static async clear(hash, pending = false) {
    const DB = (!pending) ? TransactionDB : PendingTransactionDB;
    await DB.del(hash);
  }

  static async clearAll() {
    // TODO: Move pending as sub?
    await PendingTransactionDB.clear();
    await TransactionDB.clear();
  }

  static async clearAllPending() {
    await PendingTransactionDB.clear();
  }
}

module.exports = Transaction;
