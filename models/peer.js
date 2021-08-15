const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

const ipaddr = require('ipaddr.js');
const { PeerDB } = require('../util/db');

// const db = level('wallets');

// const addressPrefix = '420_';

class Peer {
  constructor(address, port) {
    this.connection = null;

    this.version = null;
    this.chainLength = null;

    this.address = address || null;
    this.port = port || 0;
  }

  static async all() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      PeerDB
        .createValueStream({ valueEncoding: 'json' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadPeer = (data) => new Promise((resolve) => {
      const peer = new Peer(data.address, data.port);
      peer.setVersion(data.version);

      resolve(peer);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadPeer(value)));
    return Promise.all(promises);
  }

  getId() {
    const ipBytes = Buffer.from(ipaddr.parse(this.getAddress()).toByteArray());

    const portBytes = Buffer.allocUnsafe(2);
    portBytes.writeUInt16BE(this.getPort());

    return Buffer.concat([ipBytes, portBytes]);
  }

  setConnection(connection) {
    this.connection = connection;
  }

  getVersion() {
    return this.version;
  }

  setVersion(version) {
    this.version = version;
  }

  getChainLength() {
    return this.chainLength;
  }

  setChainLength(length) {
    this.chainLength = length;
  }

  getPort() {
    return this.port;
  }

  setPort(port) {
    if (port < 1024 || port > 49151 ) {
      throw Error('Invalid port. Range 1024 - 49151');
    }

    this.port = port;
  }

  getAddress() {
    return this.address;
  }

  setAddress(address) {
    if (!ipaddr.isValid(address)) {
      throw Error('Invalid IP address');
    }

    this.address = address;
  }

  static async clear(key) {
    PeerDB.del(key);
  }

  static async clearAll() {
    await PeerDB.clear();
  }

  static toSaveData(peer) {
    return {
      version: peer.getVersion(),
      chainLength: peer.getChainLength(),
      address: peer.getAddress(),
      port: peer.getPort(),
    };
  }

  static fromSaveData(data) {
    const peer = new Peer(data.address, data.port);
    peer.setVersion(data.version);
    peer.setChainLength(data.chainLength);

    return peer;
  }

  static async load(key) {
    let data;

    try {
      data = await PeerDB.get(key, { valueEncoding: 'json' });
    } catch (e) {
      return null;
    }

    return Peer.fromSaveData(data);
  }

  static async save(peer) {
    const key = peer.getId();
    const data = Peer.toSaveData(peer);

    await PeerDB.put(key, data, { valueEncoding: 'json' });
    return { key, data };
  }
}

module.exports = Peer;
