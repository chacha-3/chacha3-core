const assert = require('assert');
const bent = require('bent');
const jsonpack = require('jsonpack');

const { XXHash64 } = require('xxhash');

const debug = require('debug')('peer:model');

const Chain = require('./chain');
const Block = require('./block');

const { version } = require('../package.json');

const { PeerDB } = require('../util/db');
const { config, isTestEnvironment } = require('../util/env');

const { randomNumberBetween } = require('../util/math');
const { serializeBuffer, packObject, unpackObject } = require('../util/serialize');

const { sendTestRequest, HOST_127_0_0_100, PORT_7000 } = require('../util/peer-response');

class Peer {
  constructor(host, port = 0) {
    assert(host !== null);
    assert(port !== 0);

    this.connection = null;

    this.version = null;
    this.chainLength = null;
    this.chainWork = 0;

    this.host = host;
    this.setPort(port);

    this.status = Peer.Status.Idle;
    this.failedConnect = 0;
  }

  static get SeedList() {
    const seedPeers = [
      { host: 'devnode1.chacha3.net', port: 5438 },
    ];

    if (isTestEnvironment) {
      seedPeers.push({ host: HOST_127_0_0_100, port: PORT_7000 });
    }

    return seedPeers;
  }

  static randomizeLocalNonce() {
    Peer.localNonce = randomNumberBetween(1, 2 ** 32);
  }

  static generateKey(host, port) {
    const hash = new XXHash64(0x02541cbe);
    hash.update(Buffer.from(`${host}:${port}`, 'utf-8'));

    return hash.digest('buffer');
  }

  static async all() {
    const readValues = () => new Promise((resolve) => {
      const values = [];

      PeerDB
        .createValueStream({ valueEncoding: 'binary' })
        .on('data', async (data) => {
          values.push(data);
        })
        .on('end', () => resolve(values));
    });

    const values = await readValues();

    const loadPeer = (data) => new Promise((resolve) => {
      const peer = Peer.fromSaveData(unpackObject(data));
      resolve(peer);
    });

    const promises = [];

    values.forEach((value) => promises.push(loadPeer(value)));
    return Promise.all(promises);
  }

  static async activeList() {
    const peers = await Peer.all();
    return peers.filter((peer) => peer.getStatus() === Peer.Status.Active);
  }

  // static sendToListeners(data) {
  //   const socketIds = Object.keys(Peer.socketListeners);

  //   for (let i = 0; i < socketIds.length; i += 1) {
  //     const listenerInfo = Peer.socketListeners[socketIds];

  //     const { connection, listenActions } = listenerInfo;

  //     const { action } = data;
  //     assert(action !== null);

  //     if (listenActions.includes(action)) {
  //       connection.socket.send(JSON.stringify(data));
  //     }
  //   }
  // }

  static async broadcastAction(actionName, options) {
    const activePeers = await Peer.activeList();

    const merged = Object.assign(options || {}, { action: actionName });

    const promises = [];

    const request = (peer) => new Promise((resolve) => {
      debug(`Broadcast to peer ${peer.getHost()}:${peer.getPort()} ${JSON.stringify(merged)}`);
      resolve(peer.sendRequest(merged));
    });

    for (let i = 0; i < activePeers.length; i += 1) {
      promises.push(request(activePeers[i]));
    }

    // Peer.sendToListeners(merged);

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

  static async seedOrList() {
    let peers = await Peer.all();

    // Configurable. Possibly hard code the number instead.
    const seedThreshold = Peer.SeedList.length;

    if (peers.length <= seedThreshold) {
      await Peer.addSeed();
      peers = await Peer.all();
    }

    return peers;
  }

  static async reachOutAll() {
    if (Peer.localNonce === 0) {
      Peer.randomizeLocalNonce();
    }

    const peers = await Peer.seedOrList();
    debug(`Reaching out all: ${peers.length}`);

    const promises = [];
    for (let i = 0; i < peers.length; i += 1) {
      promises.push(peers[i].reachOut());
    }

    return Promise.all(promises);
  }

  static async withLongestActiveChains() {
    const activePeers = await Peer.activeList();

    // Sort by total work in descending order
    return activePeers.sort((a, b) => b.getTotalWork() - a.getTotalWork());
  }

  static addSyncInterval(peer) {
    // if (isTestEnvironment) {
    //   return;
    // }

    const key = serializeBuffer(peer.getId());

    // May not need
    if (Peer.syncIntervals[key]) {
      return;
    }

    Peer.syncIntervals[key] = setInterval(() => peer.syncPeerList(), 60000); // TODO: Tune timeout
  }

  static clearSyncInterval(peerId) {
    const key = serializeBuffer(peerId);

    clearInterval(Peer.syncIntervals[key]);
    delete Peer.syncIntervals[key];
  }

  getId() {
    return Peer.generateKey(this.getHost(), this.getPort());
  }

  getVersion() {
    return this.version;
  }

  setVersion(versionName) {
    this.version = versionName;
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
    if (port < 1 || port > 65536) {
      throw Error('Invalid port. Range 1024 - 49151');
    }

    this.port = port;
  }

  getHost() {
    return this.host;
  }

  getStatus() {
    return this.status;
  }

  setStatus(status) {
    this.status = status;
  }

  setPeerInfo(versionName, chainLength, chainWork) {
    this.setVersion(versionName);
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

    const {
      version, chainLength, chainWork, networkId, nonce,
    } = data;

    if (networkId !== config.networkId) {
      return false;
    }

    this.setPeerInfo(version, chainLength, chainWork);

    const isSelf = Peer.localNonce === nonce;

    if (isSelf) {
      await Peer.clear(this.getId());
      return false;
    }

    this.setCompatibilityStatus();
    await this.save();

    // Follow up and retrieve peer
    await this.syncPeerList();
    Peer.addSyncInterval(this);

    // Update active peer status again
    const fiveMinutes = 60000; // TODO: Temp change to 1 minute
    this.retryReachOut(fiveMinutes);

    return true;
  }

  async reachOutFail() {
    const status = (this.getStatus() === Peer.Status.Active)
      ? Peer.Status.Inactive
      : Peer.Status.Unreachable;

    this.setStatus(status);
    await this.save();

    this.failConnect();
  }

  async failConnect() {
    this.failedConnect += 1;

    if (this.failedConnect >= 4) {
      await Peer.clear(this.getId());
    } else {
      const oneMinute = 60000;
      this.retryReachOut(oneMinute);
    }
  }

  retryReachOut(inMillis) {
    if (isTestEnvironment) {
      return;
    }

    setTimeout(() => this.reachOut(), inMillis);
  }

  static requestHeaders() {
    const { host, port } = config;

    return {
      [Peer.RequestHeader.Host]: host,
      [Peer.RequestHeader.Port]: port,
      [Peer.RequestHeader.ChainLength]: Chain.mainChain.getLength(),
      [Peer.RequestHeader.ChainWork]: Chain.mainChain.getTotalWork(),
      [Peer.RequestHeader.Version]: version,
    };
  }

  static parseRequestHeaders(request) {
    const { headers } = request;

    return {
      chainWork: Number.parseInt(headers[Peer.RequestHeader.ChainWork], 10),
      chainLength: Number.parseInt(headers[Peer.RequestHeader.ChainLength], 10),
      host: headers[Peer.RequestHeader.Host],
      port: Number.parseInt(headers[Peer.RequestHeader.Port], 10),
      version: headers[Peer.RequestHeader.Version],
    };
  }

  // static validRequestHeaders(request) {
  //   const { headers } = request;
  //   const required = ['chacha3-port', 'chacha3-chain-work', 'chacha3-chain-length'];

  //   for (let i = 0; i < required.length; i += 1) {
  //     if (!Object.prototype.hasOwnProperty.call(headers, required[i])) {
  //       return false;
  //     }
  //   }

  //   return true;
  // }

  static reachingOutSelf(options) {
    const { action, nonce } = options;
    return action === 'nodeInfo' && nonce === Peer.localNonce;
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
    const response = await this.callAction('listPeers', { status: 'active|inactive' });

    if (!response) {
      return;
    }

    const { data } = response;

    const currentPeers = await Peer.all();

    for (let i = 0; i < data.length; i += 1) {
      const receivedPeer = Peer.fromObject(data[i]);

      debug(`Received peer: ${JSON.stringify(data[i])}`);

      const acceptStatus = [Peer.Status.Active, Peer.Status.Inactive];
      const notExisting = currentPeers.findIndex((cur) => Peer.areSame(receivedPeer, cur)) === -1;

      if (notExisting && acceptStatus.includes(receivedPeer.getStatus())) {
        receivedPeer.setStatus(Peer.Status.Idle);
        await receivedPeer.reachOut();
        // debug(`New peer from sync. Saved ${receivedPeer.getHost()}, ${receivedPeer.getPort()}`);
        // receivedPeer.setStatus(Peer.Status.Idle);
        // await receivedPeer.save();
      }
    }

    return true;
  }

  async sendRequest(options, compress = false) {
    const testWhitelist = ['ping'];

    // FIXME: Double is test environment check
    if (isTestEnvironment) {
      const response = sendTestRequest(this.getHost(), this.getPort(), options);

      if (response !== null) {
        return JSON.parse(response);
      }
    }

    // Only ping action goes through for testing
    if (isTestEnvironment && !testWhitelist.includes(options.action)) {
      return null;
    }

    const url = `http://${this.formattedAddress()}${compress ? '?format=jsonpack' : ''}`;
    const responseFormat = compress ? 'string' : 'json';

    const post = bent(url, 'POST', responseFormat, 200, Peer.requestHeaders());

    try {
      let response = await post('', options);

      if (compress) {
        response = jsonpack.unpack(response);
      }

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

    // Request compress for calls that can be very large.
    const compressActions = ['blockInfo', 'pullChain'];
    return this.sendRequest(params, compressActions.includes(actionName));
  }

  // TODO: Use set peer info
  async updateChainInfo(chain) {
    this.setChainLength(chain.getLength());
    this.setTotalWork(chain.getTotalWork());
  }

  isSignificantlyAhead() {
    const threshold = Chain.mainChain.getCurrentDifficulty() * 5;
    const upperThreshold = Chain.mainChain.getTotalWork() + threshold;

    // Peer's chain's work is ahead
    return this.getTotalWork() > upperThreshold;
  }

  isSignificantlyBehind() {
    const threshold = Chain.mainChain.getCurrentDifficulty() * 5;
    const lowerThreshold = Chain.mainChain.getTotalWork() - threshold;

    return this.getTotalWork() < lowerThreshold;
  }

  async syncChain() {
    // Avoid synching with more than one at a time
    if (Chain.mainChain.isSynching()) {
      // Return true to avoid trying next peer
      return true;
    }

    Chain.mainChain.setSynching(true);

    const pulledChain = await this.fetchChain();

    if (!pulledChain.verifyHeaders()) {
      return false;
    }

    const divergeIndex = Chain.mainChain.compareWork(pulledChain);

    if (divergeIndex < 1) {
      debug(`Did not sync. Diverge index: ${divergeIndex}`);
      return false;
    }

    const valid = await this.syncForwardBlocks(pulledChain, divergeIndex);

    if (!valid) {
      return false;
    }

    // TODO: Update mainchain to pulled chain

    Chain.mainChain.setSynching(false);

    await this.updateChainInfo(pulledChain);
    this.save();

    return valid;
  }

  async pushDiscoveredBlocks(pulledChain) {

  }

  async syncForwardBlocks(pulledChain, startIndex) {
    const tempChain = Chain.mainChain.clone(0, startIndex);
    await tempChain.loadBalances();

    // Copy and slice main chain
    for (let i = startIndex; i < pulledChain.getLength(); i += 1) {
      const header = pulledChain.getBlockHeader(i);
      const block = await this.fetchBlock(header.getHash());

      // TODO:
      // if (block === null) {
      //   return false;
      // }

      const valid = await tempChain.confirmNewBlock(block);

      // FIXME: If invalid need to revert
      if (!valid) {
        await tempChain.clearBlocks(startIndex);
        return false;
      }
    }

    await Chain.mainChain.clearBlocks(startIndex);

    // Override main chain
    Chain.mainChain = tempChain;
    await tempChain.save();

    return true;
  }

  async fetchChain() {
    const response = await this.callAction('pullChain');

    // TODO: Move to call action
    // if (!response) {
    //   return null;
    // }

    const { data } = response;
    return Chain.fromObject(data);
  }

  async fetchBlock(hash) {
    const response = await this.callAction('blockInfo', { hash: serializeBuffer(hash) });

    // TODO: Handle
    // if (!response) {
    //   return null;
    // }

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
    Peer.clearSyncInterval(key);
    await PeerDB.del(key);
  }

  static async clearAll() {
    const peers = await Peer.all();

    const promises = [];
    for (let i = 0; i < peers.length; i += 1) {
      promises.push(Peer.clear(peers[i].getId()));
    }

    await Promise.all(promises);
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

  async reachOutIfInactive() {
    const activeStatus = [Peer.Status.Active, Peer.Status.Incompatible];

    if (activeStatus.includes(this.getStatus())) {
      return false;
    }

    await this.reachOut();
    return true;
  }

  static async loadOrDiscover(host, port) {
    let peer = await Peer.load(host, port);
    let created = false;

    if (!peer) {
      peer = new Peer(host, port);
      await peer.reachOut();

      created = true;
    } else {
      await peer.reachOutIfInactive();
    }

    return [peer, created];
  }

  static async load(host, port) {
    let data;

    try {
      const key = Peer.generateKey(host, port);
      data = await PeerDB.get(key, { keyEncoding: 'binary', valueEncoding: 'binary' });
    } catch (e) {
      return null;
    }

    return Peer.fromSaveData(unpackObject(data));
  }

  async save() {
    const key = this.getId();
    const data = Peer.toSaveData(this);

    await PeerDB.put(key, packObject(data), { keyEncoding: 'binary', valueEncoding: 'binary' });
  }

  // static addSocketListener(id, connection) {
  //   Peer.socketListeners[id] = {
  //     connection,
  //     listenActions: [],
  //   };

  //   console.log('add socket listener', Peer.socketListeners);
  // }

  // static setSocketListenActions(id, listenActions = []) {
  //   console.log('set socket listener', id, Peer.socketListeners);
  //   Peer.socketListeners[id].listenActions = listenActions;
  // }
}

Peer.localNonce = 0;

Peer.Status = {
  Idle: 'idle',
  Reaching: 'reaching', // TODO: Use
  Inactive: 'inactive',
  Unreachable: 'unreachable',
  Active: 'active',
  Incompatible: 'incompatible',
};

Peer.NodeType = {
  Full: 'full',
  Light: 'light',
  Unknown: 'unknown',
};

// Peer.socketListeners = [];
Peer.syncIntervals = {};

Peer.RequestHeader = {
  Host: 'chacha3-host',
  Port: 'chacha3-port',
  ChainLength: 'chacha3-chain-length',
  ChainWork: 'chacha3-chain-work',
  Version: 'chacha3-version',
};

module.exports = Peer;
