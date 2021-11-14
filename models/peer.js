const assert = require('assert');
const bent = require('bent');

const debug = require('debug')('peer:model');

const ipaddr = require('ipaddr.js');
const Chain = require('./chain');
const Block = require('./block');

const { version } = require('../package.json');

const { PeerDB } = require('../util/db');
const { randomNumberBetween } = require('../util/math');
const { serializeBuffer } = require('../util/serialize');

const { sendTestRequest } = require('../util/peer-response');

class Peer {
  constructor(host, port = 0) {
    assert(port !== 0);
    this.connection = null;

    this.version = null;
    this.chainLength = null;
    this.chainWork = 0;

    this.host = host || null;
    this.port = port;

    this.status = Peer.Status.Idle;
    this.failedConnect = 0;
  }

  static get SeedList() {
    const seedPeers = [
      { host: '127.0.0.1', port: 3000 },
    ];

    return seedPeers;
  }

  static randomizeLocalNonce() {
    Peer.localNonce = randomNumberBetween(1, Number.MAX_SAFE_INTEGER);
  }

  static generateKey(host, port) {
    const ipBytes = Buffer.from(ipaddr.parse(host).toByteArray());

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

    const promises = [];

    const request = (peer) => new Promise((resolve) => {
      debug(`Broadcast to peer ${peer.getHost()}:${peer.getPort()} ${JSON.stringify(merged)}`);
      resolve(peer.sendRequest(merged));
    });

    for (let i = 0; i < activePeers.length; i += 1) {
      promises.push(request(activePeers[i]));
    }

    // TODO: Map response to peer
    return Promise.all(promises);
  }

  static async addSeed() {
    const seeds = Peer.SeedList;

    const promises = [];

    const savePeer = (seed) => new Promise((resolve) => {
      const newPeer = new Peer(seed.host, seed.port);
      newPeer.setStatus(Peer.Status.Inactive);

      debug(`Add seed: ${seed.host}:${seed.port}`);
      resolve(newPeer.save());
    });

    for (let i = 0; i < seeds.length; i += 1) {
      promises.push(savePeer(seeds[i]));
    }

    await Promise.all(promises);
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
    return Peer.generateKey(this.getHost(), this.getPort());
  }

  // getNonce() {
  //   return this.nonce;
  // }

  // setConnection(connection) {
  //   this.connection = connection;
  // }

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
    // if (port < 1024 || port > 49151) {
    //   throw Error('Invalid port. Range 1024 - 49151');
    // }

    this.port = port;
  }

  getHost() {
    return this.host;
  }

  // setHost(host) {
  //   // FIXME: Disabled. Temp
  //   // if (!ipaddr.isValid(address)) {
  //   //   throw Error('Invalid IP address');
  //   // }

  //   this.host = host;
  // }
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
    // No real check now. Compatible with all.
    const [major, minor, build] = this.getVersion().split('.');

    if (major < 0 || minor < 0 || build < 1) {
      return false;
    }

    return true;
  }

  formattedAddress() {
    return `${this.getHost()}:${this.getPort()}`;
  }

  setCompatibilityStatus() {
    this.setStatus(this.isCompatible() ? Peer.Status.Active : Peer.Status.Incompatible);
  }

  async reachOut() {
    // TODO: Disable for test
    let data;
    debug(`Reach out to peer ${this.formattedAddress()}`);

    try {
      const response = await this.callAction('nodeInfo', { nonce: Peer.localNonce });
      data = response.data;
    } catch (e) {
      this.reachOutFail();
      return false;
    }

    this.setPeerInfo(data.version, data.chainLength, data.chainWork);

    const isSelf = Peer.localNonce === data.nonce;
    if (isSelf) {
      await Peer.clear(this.getId());
      return false;
    }

    this.setCompatibilityStatus();
    await this.save();

    // Follow up and retrieve peer
    await this.syncPeerList();

    return true;
  }

  async reachOutFail() {
    const status = (this.getStatus() === Peer.Status.Active)
      ? Peer.Status.Inactive
      : Peer.Status.Unreachable;

    this.setStatus(status);

    await this.save();
  }

  static requestHeaders() {
    return {
      'bong-port': process.env.PORT || 3000,
      'bong-chain-length': Chain.mainChain.getLength(),
      'bong-chain-work': Chain.mainChain.getTotalWork(),
      'bong-version': version,
    };
  }

  static areSame(peer1, peer2) {
    if (peer1.getHost() !== peer2.getHost()) {
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

    // TODO:
    // if (!data) {
    //   return false;
    // }

    const currentPeers = await Peer.all();

    for (let i = 0; i < data.length; i += 1) {
      const receivedPeer = Peer.fromObject(data[i]);
      debug(`Received peer: ${JSON.stringify(data[i])}`);

      if (currentPeers.findIndex((cur) => Peer.areSame(receivedPeer, cur)) === -1) {
        debug(`New peer from sync. Saved ${receivedPeer.getHost()}, ${receivedPeer.getPort()}`);
        receivedPeer.setStatus(Peer.Status.Idle);
        await receivedPeer.save();
      }
    }

    return true;
  }

  async sendRequest(options) {
    const testWhitelist = ['ping'];

    if (process.env.NODE_ENV === 'test') {
      const response = sendTestRequest(this.getHost(), this.getPort(), options);

      if (response !== null) {
        return JSON.parse(response);
      }
    }

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

  async callAction(actionName, options = {}) {
    const params = Object.assign(options, { action: actionName });
    debug(`Call peer action: ${actionName}, ${JSON.stringify(params)}`);

    return this.sendRequest(params);
  }

  // TODO: Use set peer info
  async updateChainInfo(chain) {
    this.setChainLength(chain.getLength());
    this.setTotalWork(chain.getTotalWork());
  }

  async syncChain() {
    // Avoid synching with more than one at a time
    if (Chain.mainChain.isSynching()) {
      // Return true to avoid trying next peer
      return true;
    }

    Chain.mainChain.setSynching(true);

    const pulledChain = await this.fetchChain();
    const divergeIndex = Chain.mainChain.compareWork(pulledChain);

    if (divergeIndex < 1) {
      debug(`Did not sync. Diverge index: ${divergeIndex}`);
      return false;
    }

    const valid = await this.syncForwardBlocks(pulledChain, divergeIndex);

    if (!valid) {
      return false;
    }

    Chain.mainChain.clearBlocks(divergeIndex);
    await Chain.save(pulledChain);

    // TODO: Update mainchain to pulled chain

    Chain.mainChain.setSynching(false);

    await this.updateChainInfo(pulledChain);
    this.save();

    return valid;
  }

  async syncForwardBlocks(pulledChain, startIndex) {
    for (let i = startIndex; i < pulledChain.getLength(); i += 1) {
      const header = pulledChain.getBlockHeader(i);
      const block = await this.fetchBlock(header.getHash());

      if (block === null) {
        return false;
      }

      const valid = await Chain.mainChain.confirmNewBlock(block);

      if (!valid) {
        return false;
      }
    }

    return true;
  }

  async fetchChain() {
    const response = await this.callAction('pullChain');

    if (!response) {
      return null;
    }

    const { data } = response;
    return Chain.fromObject(data);
  }

  async fetchBlock(hash) {
    const response = await this.callAction('blockInfo', { hash: serializeBuffer(hash) });

    if (!response) {
      // TODO: Handle
      return null;
    }

    const { data } = response;
    return Block.fromObject(data);
  }

  toObject() {
    return {
      host: this.getHost(),
      port: this.getPort(),
      version: this.getVersion(),
      chainLength: this.getChainLength(),
      chainWork: this.getTotalWork(),
      status: this.getStatus(),
    };
  }

  static fromObject(data) {
    const peer = new Peer(data.host, data.port);
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
      host: peer.getHost(),
      port: peer.getPort(),
      status: peer.getStatus(),
    };
  }

  static fromSaveData(data) {
    const peer = new Peer(data.host, data.port);
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

  // static async checkExist(key) {
  //   try {
  //     await PeerDB.get(key, { valueEncoding: 'json' });
  //   } catch (e) {
  //     return false;
  //   }

  //   return true;
  // }

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
