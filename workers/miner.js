const { parentPort, workerData } = require('worker_threads');
const Header = require('../models/header');
const { randomNumberBetween } = require('../util/math');

function findNonce(data) {
  const { headerData, timeout } = data;

  const header = Header.fromObject(headerData);
  header.setNonce(randomNumberBetween(1, Number.MAX_SAFE_INTEGER));

  const start = Date.now();

  while ((Date.now() - start) < timeout) {
    header.setHash(header.computeHash());

    if (header.verifyHash(false)) {
      return header.getNonce();
    }

    header.incrementNonce();
  }

  return -1;
}

parentPort.postMessage(findNonce(workerData));
