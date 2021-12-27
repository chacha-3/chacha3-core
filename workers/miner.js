const { parentPort, workerData } = require('worker_threads');
const Header = require('../models/header');

function findNonce(data) {
  const { headerData, timeout } = data;

  const header = Header.fromObject(headerData);

  const start = Date.now();

  while ((Date.now() - start) < timeout) {
    // console.log((Date.now() - start))
    header.setHash(header.computeHash());

    if (header.verifyHash(false)) {
      console.log('found nonce ' + header.getNonce())
      return header.getNonce();
    }

    header.incrementNonce();
  }

  console.log('done finding');
  return -1;
}

parentPort.postMessage(findNonce(workerData));
