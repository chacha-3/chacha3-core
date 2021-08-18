const assert = require('assert');
const bent = require('bent');

const debug = require('debug')('peer:model');

const ipaddr = require('ipaddr.js');
const { PeerDB } = require('../util/db');
const { randomNumberBetween } = require('../util/math');

// const db = level('wallets');

// const addressPrefix = '420_';

// function randomNonce() {
//   return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER + 1);
// }

// const myNonce = randomNonce();

class Peer {
  constructor(address, port) {
    this.connection = null;

    this.version = null;
    this.chainLength = null;

    this.address = address || null;
    this.port = port || 0;

    this.status = Peer.Status.Initial;
    this.failedConnect = 0;
  }

  static randomizeLocalNonce() {
    Peer.localNonce = randomNumberBetween(1, Number.MAX_SAFE_INTEGER);
  }

  static generateKey(address, port) {
    const ipBytes = Buffer.from(ipaddr.parse(address).toByteArray());

    const portBytes = Buffer.allocUnsafe(2);
    portBytes.writeUInt16BE(port);

    return Buffer.concat([ipBytes, portBytes]);
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
      peer.setPeerInfo(data.version, data.chainLength);

      resolve(peer);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadPeer(value)));
    return Promise.all(promises);
  }

  getId() {
    return Peer.generateKey(this.getAddress(), this.getPort());
  }

  getNonce() {
    return this.nonce;
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

    if (major < 0 || minor < 0 || build < 1) {
      return false;
    }

    return true;
  }

  getStatus() {
    return this.status;
  }

  setStatus(status) {
    this.status = status;
  }

  setPeerInfo(version, chainLength) {
    this.setVersion(version);
    this.setChainLength(chainLength);
  }

  // isSelf() {
  //   return this.getNonce() === Peer.localNonce;
  // }

  isCompatible() {
    // TODO: Other compatibility check
    return this.compatibleVersion();
  }

  async reachOut() {
    let data;
    debug(`Reach out to peer ${this.getAddress()}:${this.getPort()}`);

    try {
      const response = await this.callAction('nodeInfo');
      data = response.data;
    } catch (e) {
      this.setStatus(Peer.Status.Unreachable);
      Peer.save(this);
      return;
    }

    assert(data);

    debug(`Receive response from peer ${this.getAddress()}:${this.getPort()}`);
    this.setPeerInfo(data.version, data.chainLength);

    const isSelf = Peer.localNonce === data.nonce;

    if (isSelf) {
      debug(`Reject peer ${this.getAddress()}:${this.getPort()}: Same nonce`);

      Peer.clear(this.getId());
      return;
    }

    if (!this.isCompatible()) {
      this.setStatus(Peer.Status.Incompatible);
      debug(`Incompatible peer ${this.getAddress()}:${this.getPort()}. Version ${this.getVersion()}`);
    } else {
      this.setStatus(Peer.Status.Active);
    }

    debug(`Accept peer ${this.getAddress()}:${this.getPort()}`);

    Peer.save(this);
  }

  async callAction(actionName, options) {
    const post = bent(`http://${this.getAddress()}:${this.getPort()}`, 'POST', 'json', 200);

    const params = Object.assign(options || {}, { action: actionName });
    try {
      const response = await post('', params);
      return response;
    } catch (e) {
      debug(`Peer call action error: ${e}`);
    }

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
    await PeerDB.del(key);
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
    // console.log(data);
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

Peer.localNonce = 0;

Peer.Status = {
  Initial: 'initial',
  Inactive: 'inactive',
  Unreachable: 'unreachable',
  Active: 'active',
  Incompatible: 'incompatible',
};

module.exports = Peer;
