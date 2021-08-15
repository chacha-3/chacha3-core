const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

const ipaddr = require('ipaddr.js');
const { PeerDB } = require('../util/db');

// const db = level('wallets');

// const addressPrefix = '420_';

class Peer {
  constructor() {
    this.connection = null;

    this.version = null;
    this.chainLength = null;

    this.address = null;
    this.port = 0;
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

  saveData() {
    return {
      version: this.getVersion(),
      chainLength: this.getChainLength(),
      address: this.getAddress(),
      port: this.getPort(),
    };
  }

  static async save(peer) {
    const key = peer.getId();
    const data = peer.saveData();

    await PeerDB.put(key, data, { valueEncoding: 'json' });
    return { key, data };
  }
}

module.exports = Peer;
