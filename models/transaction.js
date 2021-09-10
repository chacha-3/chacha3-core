const assert = require('assert');
const crypto = require('crypto');

const debug = require('debug')('transaction:model');

const Wallet = require('./wallet');

const { serializeBuffers, deserializeBuffers } = require('../util/serialize');
const { TransactionDB, PendingTransactionDB } = require('../util/db');
const { generateAddressEncoded } = require('./wallet');

class Transaction {
  constructor(senderKey, receiverAddress, amount) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress; // FIXME: Change to use buffer?

    this.amount = amount;

    assert.strictEqual(amount > 0, true);

    this.signature = null;
    this.time = Date.now();
  }

  hashData() {
    const data = {
      version: this.version,
      receiverAddress: this.receiverAddress, // Base54
      amount: this.amount,
      time: this.time,
    };

    assert(this.senderKey !== undefined);
    if (this.senderKey !== null) {
      data.senderKey = this.senderKey.toString('hex');
    }

    return JSON.stringify(data);
  }

  getId() {
    return crypto.createHash('SHA256').update(Buffer.from(this.hashData())).digest();
  }

  getIdHex() {
    return this.getId().toString('hex');
  }

  getVersion() {
    return this.version;
  }

  setVersion(version) {
    this.version = version;
  }

  sign(privateKey) {
    assert(this.senderKey != null);
    this.signature = crypto.sign('SHA256', Buffer.from(this.hashData()), privateKey);
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
    const senderAddress = Wallet.generateAddressEncoded(this.senderKey);

    const errors = [];

    if (this.receiverAddress === senderAddress) {
      errors.push('Same sender and receiver');
    }

    if (!Wallet.verifyAddress(this.receiverAddress)) {
      errors.push('Invalid receiver address');
    }

    if (this.amount <= 0) {
      errors.push('Amount has to be greater than 0');
    }

    return errors;
  }

  verify() {
    const errors = this.validate();

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

  static fromObject(obj) {
    const data = deserializeBuffers(obj, ['id', 'sender', 'signature']);

    const transaction = new Transaction(data.sender, data.receiver, data.amount);
    transaction.setVersion(data.version);
    transaction.setTime(data.time);
    transaction.setSignature(data.signature);
    return transaction;
  }

  toObject() {
    const data = {
      id: this.getId(), // Remove?
      // sender: this.getSenderKey() ? generateAddressEncoded(this.getSenderKey()) : null,
      sender: this.getSenderKey(),
      receiver: this.getReceiverAddress(),
      amount: this.getAmount(),
      version: this.getVersion(),
      time: this.getTime(),
      signature: this.getSignature(),
    };

    return serializeBuffers(data, ['id', 'sender', 'signature']);
  }

  toPushData() {
    assert(this.getSignature() !== null);

    return {
      key: this.getSenderKey().toString('hex'),
      address: this.getReceiverAddress(),
      amount: this.getAmount(),
      version: this.getVersion(),
      time: this.getTime(),
      signature: this.getSignature().toString('hex'),
    };
  }

  static async save(transaction, pending = false) {
    assert(transaction.getId() != null);
    const key = transaction.getId();

    if (pending) {
      try {
        await TransactionDB.get(key);
        debug('Pending transaction is prior transaction. Ignored');
        return null;
      } catch (e) {

      }
    }

    // FIXME: Use to object.
    // Unit test for set time not checking correct, prob time set is same before and after load
    const data = {
      id: transaction.getId(),
      version: transaction.getVersion(),
      senderKey: transaction.getSenderKey(),
      receiverAddress: transaction.getReceiverAddress(),
      amount: transaction.getAmount(),
      signature: transaction.getSignature(),
      time: transaction.getTime(),
    };

    const serialized = serializeBuffers(data, ['id', 'senderKey', 'signature']);

    const DB = (!pending) ? TransactionDB : PendingTransactionDB;
    await DB.put(key, serialized, { valueEncoding: 'json' });

    return { key, data };
  }

  static async load(id) {
    let loaded;

    try {
      loaded = await TransactionDB.get(id, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    const data = deserializeBuffers(loaded, ['id', 'senderKey', 'signature']);

    const transaction = new Transaction(
      data.senderKey,
      data.receiverAddress,
      data.amount,
    );

    transaction.setVersion(data.version);
    transaction.setSignature(data.signature);
    transaction.setTime(data.time);

    return transaction;
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
      // const wallet = new Wallet();
      // wallet.fromSaveData(data);

      const loaded = deserializeBuffers(data, ['id', 'senderKey', 'signature']);

      // TODO: Use from object
      const transaction = new Transaction(
        loaded.senderKey,
        loaded.receiverAddress,
        loaded.amount,
      );

      transaction.setVersion(loaded.version);
      transaction.setSignature(loaded.signature);
      transaction.setTime(loaded.time);

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
