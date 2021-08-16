const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');
const bent = require('bent');

const ipaddr = require('ipaddr.js');
const { PeerDB } = require('../util/db');
const { option } = require('yargs');

// const db = level('wallets');

// const addressPrefix = '420_';

function randomNonce() {
  return Math.floor(Math.random() * 4294967296);
}

const myNonce = randomNonce();

class Peer {
  constructor(address, port) {
    this.connection = null;

    this.version = null;
    this.chainLength = null;

    this.address = address || null;
    this.port = port || 0;

    this.nonce = randomNonce();
    this.status = '';
  }

  static get myNonce() {
    return myNonce;
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

  getNonce() {
    return this.nonce;
  }

  setNonce(nonce) {
    this.nonce = nonce;
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
    if (port < 1024 || port > 49151) {
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

  compatibleVersion() {
    // No real check now. Compatible with all.
    const [major, minor, build] = this.getVersion().split('.');

    if (major < 0) {
      return false;
    }

    if (minor < 0) {
      return false;
    }

    if (build < 1) {
      return false;
    }

    return true;
  }

  setPeerInfo(version, chainLength) {
    this.setVersion(version);
    this.setChainLength(chainLength);
  }

  isSelf() {
    return this.getNonce() === myNonce;
  }

  isCompatible() {
    // TODO: Other compatibility check
    return this.compatibleVersion();
  }

  static async reachOut(peer) {
    const { data } = await peer.callAction('nodeInfo');

    if (!data) {
      return;
    }

    peer.setPeerInfo(data.version, data.chainLength);
    peer.setNonce(data.nonce);

    if (peer.isSelf() || !peer.isCompatible()) {
      Peer.clear(peer.getId());
    }
  }

  async callAction(actionName, options) {
    const post = bent(`https://${this.getAddress()}:${this.getPort()}`, 'POST', 'json', 200);

    const params = Object.assign(options || {}, { action: actionName });
    try {
      const response = await post('', params);
      return response;
    } catch (e) {
      console.log(e);
    }
    console.log('null');
    return null;
  }

  toObject() {
    return {
      address: this.getAddress(),
      port: this.getPort(),
      version: this.getVersion(),
      chainLength: this.getChainLength(),
    };
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
