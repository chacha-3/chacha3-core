const assert = require('assert');
const bent = require('bent');

const debug = require('debug')('peer:model');

const ipaddr = require('ipaddr.js');
const { option } = require('yargs');
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
    this.chainWork = 0;

    this.address = address || null;
    this.port = port || 0;

    this.status = Peer.Status.Idle;
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
      const peer = Peer.fromSaveData(data);
      resolve(peer);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadPeer(value)));
    return Promise.all(promises);
  }

  static async broadcastAction(actionName, options) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const peers = await Peer.all();
    const merged = Object.assign(options || {}, { action: actionName });

    peers.forEach((peer) => {
      debug(`Broadcast to peer ${peer.getAddress()}:${peer.getPort()} ${JSON.stringify(merged)}`);
      peer.sendRequest(merged);
    });
  }

  static async reachOutAll() {
    const peers = await Peer.all();

    const reachOutPeer = (peer) => new Promise((resolve) => {
      resolve(peer.reachOut());
    });

    const promises = [];

    for (let i = 0; i < peers.length; i += 1) {
      promises.push(reachOutPeer(peers[i]));
    }

    return Promise.all(promises);
  }

  static async withLongestActiveChains() {
    const peers = await Peer.all();
    const activePeers = peers.filter((peer) => peer.getStatus() === Peer.Status.Active);

    // Sort by total work descending order
    const peerPriority = activePeers.sort((a, b) => b.getTotalWork() - a.getTotalWork());

    // let mostWorkPeer = null;

    // for (let i = 0; i < peers.length; i += 1) {
    //   if (mostWorkPeer === null || peers[i].getTotalWork() > mostWorkPeer.getTotalWork()) {
    //     mostWorkPeer = peers[i];
    //   }
    // }

    return peerPriority;
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

  getTotalWork() {
    return this.chainWork;
  }

  setTotalWork(work) {
    this.chainWork = work;
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

  setPeerInfo(version, chainLength, chainWork) {
    this.setVersion(version);
    this.setChainLength(chainLength);
    this.setTotalWork(chainWork);
  }

  // isSelf() {
  //   return this.getNonce() === Peer.localNonce;
  // }

  isCompatible() {
    // TODO: Other compatibility check
    return this.compatibleVersion();
  }

  async reachOut(allowSelf) {
    let data;
    debug(`Reach out to peer ${this.getAddress()}:${this.getPort()}`);

    try {
      const response = await this.callAction('nodeInfo');
      data = response.data;
    } catch (e) {
      const status = (this.getStatus() === Peer.Status.Active)
        ? Peer.Status.Inactive
        : Peer.Status.Unreachable;

      this.setStatus(status);
  
      Peer.save(this);
      return false;
    }

    assert(data);

    debug(`Receive response from peer ${this.getAddress()}:${this.getPort()}`);
    this.setPeerInfo(data.version, data.chainLength, data.chainWork);

    const isSelf = Peer.localNonce === data.nonce;

    if (isSelf && !(allowSelf || false)) {
      debug(`Reject peer ${this.getAddress()}:${this.getPort()}: Same nonce`);

      await Peer.clear(this.getId());
      return false;
    }

    if (!this.isCompatible()) {
      this.setStatus(Peer.Status.Incompatible);
      debug(`Incompatible peer ${this.getAddress()}:${this.getPort()}. Version ${this.getVersion()}`);
    } else {
      debug(`Active peer ${this.getAddress()}:${this.getPort()}. Version ${this.getVersion()}`);
      this.setStatus(Peer.Status.Active);
    }

    debug(`Accept peer ${this.getAddress()}:${this.getPort()}`);

    await Peer.save(this);
    return true;
  }

  async sendRequest(options) {
    const post = bent(`https://${this.getAddress()}:${this.getPort()}`, 'POST', 'json', 200, { 'bong-port': process.env.PORT || 3000 });

    try {
      const response = await post('', options);
      console.log(response);
      return response;
    } catch (e) {
      console.log(e);
      debug(`Peer call action error: ${e}`);
    }

    return null;
  }

  async callAction(actionName, options) {
    const params = Object.assign(options || {}, { action: actionName });
    return this.sendRequest(params);
  }

  toObject() {
    return {
      address: this.getAddress(),
      port: this.getPort(),
      version: this.getVersion(),
      chainLength: this.getChainLength(),
      chainWork: this.getTotalWork(),
      status: this.getStatus(),
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
      chainWork: peer.getTotalWork(),
      address: peer.getAddress(),
      port: peer.getPort(),
      status: peer.getStatus(),
    };
  }

  static fromSaveData(data) {
    const peer = new Peer(data.address, data.port);
    peer.setVersion(data.version);
    peer.setChainLength(data.chainLength);
    peer.setStatus(data.status);
    peer.setTotalWork(data.chainWork);

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

  static async checkExist(key) {
    try {
      await PeerDB.get(key, { valueEncoding: 'json' });
    } catch (e) {
      return false;
    }

    return true;
  }

  static async save(peer) {
    const key = peer.getId();
    const data = Peer.toSaveData(peer);

    debug(`Peer save data: ${JSON.stringify(data)}`);

    await PeerDB.put(key, data, { valueEncoding: 'json' });
    return { key, data };
  }
}

Peer.localNonce = 0;

Peer.Status = {
  Idle: 'idle',
  Inactive: 'inactive',
  Unreachable: 'unreachable',
  Active: 'active',
  Incompatible: 'incompatible',
};

module.exports = Peer;
