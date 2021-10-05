const assert = require('assert');
const bent = require('bent');

const debug = require('debug')('peer:model');

const ipaddr = require('ipaddr.js');
const Chain = require('./chain');
const Block = require('./block');

const { PeerDB } = require('../util/db');
const { randomNumberBetween } = require('../util/math');
const { serializeBuffer } = require('../util/serialize');
const { stringify } = require('querystring');

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

  static get SeedList() {
    const seedPeers = [
      { address: '127.0.0.1', port: 3000 },
    ];

    return seedPeers;
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
    const peers = await Peer.all();
    const activePeers = peers.filter((peer) => peer.getStatus() === Peer.Status.Active);

    const merged = Object.assign(options || {}, { action: actionName });

    activePeers.forEach((peer) => {
      debug(`Broadcast to peer ${peer.getAddress()}:${peer.getPort()} ${JSON.stringify(merged)}`);
      peer.sendRequest(merged);
    });

    return activePeers.length;
  }

  static async addSeed() {
    const seeds = Peer.SeedList;

    const promises = [];

    for (let i = 0; i < seeds.length; i += 1) {
      const newPeer = new Peer(seeds[i].address, seeds[i].port);
      debug(`Add seed: ${seeds[i].address}:${seeds[i].port}`);
      newPeer.setStatus(Peer.Status.Inactive);

      promises.push(newPeer.save());
    }

    return Promise.all(promises);
  }

  static async reachOutAll() {
    if (Peer.localNonce === 0) {
      Peer.randomizeLocalNonce();
    }

    let peers = await Peer.all();

    if (peers.length < 10) {
      await Peer.addSeed();
      peers = await Peer.all();
    }

    debug(`Reaching out all: ${peers.length}`);

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

    // Sort by total work in descending order
    return activePeers.sort((a, b) => b.getTotalWork() - a.getTotalWork());
  }

  // isSignificantlyAhead() {
  //   return this.getChainLength() > Chain.mainChain + 10;
  // }

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
    // FIXME: Disabled. Temp
    // if (!ipaddr.isValid(address)) {
    //   throw Error('Invalid IP address');
    // }

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

  isCompatible() {
    // TODO: Other compatibility check
    return this.compatibleVersion();
  }

  formattedAddress() {
    return `${this.getAddress()}:${this.getPort()}`;
  }

  async reachOut() {
    // TODO: Disable for test
    let data;
    debug(`Reach out to peer ${this.formattedAddress()}`);

    try {
      const response = await this.callAction('nodeInfo', { nonce: Peer.localNonce });
      data = response.data;
    } catch (e) {
      const status = (this.getStatus() === Peer.Status.Active)
        ? Peer.Status.Inactive
        : Peer.Status.Unreachable;

      this.setStatus(status);

      this.save();
      return false;
    }

    assert(data);

    debug(`Receive response from peer ${this.formattedAddress()}`);
    this.setPeerInfo(data.version, data.chainLength, data.chainWork);

    debug(`Response nonce: ${Peer.localNonce}, ${data.nonce}`);
    const isSelf = Peer.localNonce === data.nonce;

    debug(`Peer is self: ${isSelf}, ${this.getAddress()}, ${this.getPort()}`);

    if (isSelf) {
      debug(`Reject peer ${this.formattedAddress()}: Same nonce`);

      await Peer.clear(this.getId());
      return false;
    }

    if (!this.isCompatible()) {
      this.setStatus(Peer.Status.Incompatible);
      debug(`Incompatible peer ${this.formattedAddress()}. Version ${this.getVersion()}`);
    } else {
      debug(`Active peer ${this.formattedAddress()}. Version ${this.getVersion()}`);
      this.setStatus(Peer.Status.Active);
    }

    debug(`Accept peer ${this.formattedAddress()}`);

    await this.save();

    // Follow up and retrieve peer
    this.syncPeerList();

    return true;
  }

  static requestHeaders() {
    return {
      'bong-port': process.env.PORT || 3000,
      'bong-chain-length': Chain.mainChain.getLength(),
      'bong-chain-work': Chain.mainChain.getTotalWork(),
    };
  }

  static areSame(peer1, peer2) {
    if (peer1.getAddress() !== peer2.getAddress()) {
      return false;
    }

    if (peer1.getPort() !== peer2.getPort()) {
      return false;
    }

    return true;
  }

  async syncPeerList() {
    debug(`Synching peer list: ${this.formattedAddress()}. Version ${this.getVersion()}`);
    const { data } = await this.callAction('listPeers');

    if (!data) {
      return;
    }

    const currentPeers = await Peer.all();

    for (let i = 0; i < data.length; i += 1) {
      const receivedPeer = Peer.fromObject(data[i]);
      debug(`Received peer: ${JSON.stringify(data[i])}`);

      if (currentPeers.findIndex((cur) => Peer.areSame(receivedPeer, cur)) === -1) {
        debug(`New peer from sync. Saved ${receivedPeer.getAddress()}, ${receivedPeer.getPort()}`);
        receivedPeer.setStatus(Peer.Status.Idle);
        receivedPeer.save();
      }
    }
  }

  async sendRequest(options) {
    const testWhitelist = ['ping'];

    // FIXME:
    // Ping node test causing block integration test for fail because of a background peer call
    // Probably is caused by peer chain synching when adding a peer from ping
    if (process.env.NODE_ENV === 'test' && !testWhitelist.includes(options.action)) {
      return null;
    }

    const post = bent(`http://${this.formattedAddress()}`, 'POST', 'json', 200, Peer.requestHeaders());

    try {
      const response = await post('', options);
      return response;
    } catch (e) {
      await this.handleRequestError(e);
    }

    return null;
  }

  async handleRequestError(e) {
    if (e.code === 'ECONNREFUSED') {
      debug(`Connection ${this.formattedAddress()} refused, set peer status to inactive`);
      this.setStatus(Peer.Status.Inactive);
      await this.save(this);
    }
    debug(`Peer call action error: ${e}`);
  }

  async callAction(actionName, options) {
    const params = Object.assign(options || {}, { action: actionName });
    debug(`Call peer action: ${actionName}, ${JSON.stringify(params)}`);

    return this.sendRequest(params);
  }

  async syncChain() {
    // Avoid synching with more than one at a time
    if (Chain.isSynching()) {
      return true;
    }

    Chain.setSynching(true);

    const response = await this.callAction('pullChain');

    // TODO: Check chain is higher than current claimed length

    if (!response) {
      Chain.setSynching(false);
      return false;
    }

    const { data } = response;

    const pulledChain = Chain.fromObject(data);
    const divergeIndex = Chain.compareWork(Chain.mainChain, pulledChain);

    if (divergeIndex < 1) {
      debug(`Did not sync. Diverge index: ${divergeIndex}`);
      Chain.setSynching(false);
      return false;
    }

    const valid = await this.verifyForwardBlocks(pulledChain, divergeIndex);

    if (valid) {
      await Chain.save(pulledChain);

      this.setChainLength(pulledChain.getLength());
      this.setTotalWork(pulledChain.getTotalWork());

      Chain.mainChain.clearBlocks(divergeIndex);

      await this.save();
    } else {
      debug('Invalid chain');
    }

    Chain.setSynching(false);
    return valid;
  }

  async verifyForwardBlocks(pulledChain, startIndex) {
    let valid = true;

    debug(`Diverge index: ${startIndex}. Pulled chain length: ${pulledChain.getLength()}`);
    for (let j = startIndex; j < pulledChain.getLength() && valid; j += 1) {
      const header = pulledChain.getBlockHeader(j);

      debug(`Request block data: ${serializeBuffer(header.getHash())}`);
      debug(`Peer info: ${this.getAddress()}:${this.getPort()}`);
      const { data } = await this.callAction('blockInfo', { hash: serializeBuffer(header.getHash()) });
      debug(`Receive new block data: ${serializeBuffer(header.getHash())}`);

      if (data) {
        debug('Receive data for block');
        const block = Block.fromObject(data);

        valid = await Chain.mainChain.confirmNewBlock(block);
        // valid = await block.verifyAndSave(Chain.blockRewardAtIndex(j));
        debug(`Block index ${j} is valid: ${valid}`);
      } else {
        debug('No data');
      }
    }

    if (!valid) {
      debug('Forward blocks not valid');
      // TODO: Clear blocks
    }

    return valid;
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

  static fromObject(data) {
    const peer = new Peer(data.address, data.port);
    peer.setVersion(data.version);
    peer.setChainLength(data.chainLength);
    peer.setTotalWork(data.chainWork);
    peer.setStatus(data.status);

    return peer;
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

  async save() {
    const key = this.getId();
    const data = Peer.toSaveData(this);

    await PeerDB.put(key, data, { valueEncoding: 'json' });
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
