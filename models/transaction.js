const assert = require('assert');
const crypto = require('crypto');

const debug = require('debug')('transaction:model');

const Wallet = require('./wallet');

const {
  serializeObject, serializeBuffer, deserializeBuffer, deserializeBigInt, packObject, unpackObject,
} = require('../util/serialize');

const { TransactionDB, PendingTransactionDB } = require('../util/db');

class Transaction {
  constructor(senderKey, receiverAddress, amount, type = Transaction.Type.Send) {
    this.version = 1;

    this.senderKey = senderKey;
    this.receiverAddress = receiverAddress;

    // assert.strictEqual(amount > 0, true);
    this.amount = (typeof (amount) === 'bigint') ? amount : BigInt(amount);
    this.fee = 0n;

    this.signature = null;
    this.time = Date.now();

    this.type = type;
  }

  hashData() {
    const data = {
      version: this.version,
      senderKey: this.getSenderKey(),
      receiverAddress: this.receiverAddress,
      amount: this.amount,
      time: this.time,
      type: this.getType(),
      fee: this.getFee(),
    };

    assert(typeof (data.amount) === 'bigint');
    assert(this.senderKey !== undefined);

    return JSON.stringify(serializeObject(data));
  }

  getId() {
    // SHA-256 for browser compatability
    return crypto.createHash('SHA256').update(Buffer.from(this.hashData())).digest();
  }

  getIdHex() {
    return serializeBuffer(this.getId());
  }

  isCoinbase() {
    if (this.getSenderKey() !== null || this.getSignature() !== null) {
      return false;
    }

    if (this.getType() !== Transaction.Type.Mine) {
      return false;
    }

    return true;
  }

  getType() {
    return this.type;
  }

  setType(type) {
    this.type = type;
  }

  getVersion() {
    return this.version;
  }

  setVersion(version) {
    this.version = version;
  }

  async sign(privateKey, password = '') {
    // assert(this.senderKey != null);

    const decrypted = await Wallet.decryptPrivateKey(privateKey, password);

    if (decrypted === null) {
      return false;
    }

    const keyObject = crypto.createPrivateKey({
      key: decrypted, format: 'der', type: 'pkcs8',
    });

    this.signature = crypto.sign('SHA384', this.getId(), keyObject);

    return true;
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

  getFee() {
    return this.fee;
  }

  setFee(fee) {
    this.fee = (typeof (fee) === 'bigint') ? fee : BigInt(fee);
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

    if (this.fee < 0n) {
      errors.push('Fee has to be a positive number');
    }

    if (!Object.values(Transaction.Type).includes(this.getType())) {
      errors.push('Invalid transaction type');
    }

    return errors;
  }

  verify() {
    const errors = this.validate();

    if (this.getSenderKey() === null) {
      debug('Skip transaction verification');
      return true;
    }

    if (errors.length > 0) {
      debug(`Failed transaction validation: ${JSON.stringify(errors)}`);
      return false;
    }

    const senderKeyObject = crypto.createPublicKey({
      key: this.getSenderKey(), format: 'der', type: 'spki',
    });

    try {
      return crypto.verify('SHA384', this.getId(), senderKeyObject, this.getSignature());
    } catch {
      debug('Failed transaction signature verification');
      return false;
    }
  }

  static fromObject(data) {
    const transaction = new Transaction(
      deserializeBuffer(data.senderKey),
      deserializeBuffer(data.receiverAddress),
      deserializeBigInt(data.amount),
    );

    transaction.setVersion(data.version);
    transaction.setTime(data.time);
    transaction.setSignature(deserializeBuffer(data.signature));
    transaction.setType(data.type);
    transaction.setFee(deserializeBigInt(data.fee));

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
      type: this.getType(),
      fee: this.getFee(),
    };

    return serializeObject(data);
  }

  toPushData() {
    assert(this.getSignature() !== null);

    return serializeObject({
      senderKey: this.getSenderKey(),
      address: this.getReceiverAddress(),
      amount: this.getAmount(),
      version: this.getVersion(),
      time: this.getTime(),
      signature: this.getSignature(),
    });
  }

  async saveAsPending() {
    assert(this.getId() != null);
    const key = this.getId();

    const exist = await this.isSaved();

    if (exist) {
      debug('Pending transaction is prior transaction. Ignored');
      return false;
    }

    debug('Pending transaction is not prior transaction. Continue save');
    await PendingTransactionDB.put(key, packObject(this.toSaveData()), {
      keyEncoding: 'binary',
      valueEncoding: 'binary',
    });

    debug(`Saved pending transaction: ${serializeBuffer(key)}`);
    return true;
  }

  async save() {
    assert(this.getId() != null);
    const key = this.getId();

    await TransactionDB.put(key, packObject(this.toSaveData()), {
      keyEncoding: 'binary',
      valueEncoding: 'binary',
    });
  }

  toSaveData() {
    const data = {
      version: this.getVersion(),
      senderKey: this.getSenderKey(),
      receiverAddress: this.getReceiverAddress(),
      amount: this.getAmount(),
      signature: this.getSignature(),
      time: this.getTime(),
      type: this.getType(),
      fee: this.getFee(),
    };

    return data;
  }

  static fromSaveData(loaded) {
    const {
      senderKey, receiverAddress, amount, type,
    } = loaded;

    const transaction = new Transaction(senderKey, receiverAddress, amount, type);
    transaction.setSignature(loaded.signature);
    transaction.setTime(loaded.time);
    transaction.setFee(loaded.fee);

    return transaction;
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
      await TransactionDB.get(this.getId(), { keyEncoding: 'binary' });
    } catch (e) {
      return false;
    }

    return true;
  }

  static async load(id) {
    let loaded;

    try {
      loaded = await TransactionDB.get(id, { keyEncoding: 'binary', valueEncoding: 'binary' });
    } catch (e) {
      return null;
    }

    return Transaction.fromSaveData(unpackObject(loaded, ['amount', 'fee']));
    // return Transaction.fromObject(unpackObject(loaded, ['amount', 'fee']));
  }

  static async loadPending() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      PendingTransactionDB
        .createValueStream({ valueEncoding: 'binary' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadTransaction = (data) => new Promise((resolve) => {
      const transaction = Transaction.fromSaveData(unpackObject(data, ['amount', 'fee']));
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

Transaction.Type = {
  Mine: 'mine',
  Send: 'send',
};

module.exports = Transaction;
