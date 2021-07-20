const crypto = require('crypto');
const assert = require('assert');
const bs58 = require('bs58');

// const db = level('wallets');

// const addressPrefix = '420_';

class Peer {
  constructor() {
    this.connection = null;
  }

  setConnection(connection) {
    this.connection = connection;
  }
}

module.exports = Peer;
