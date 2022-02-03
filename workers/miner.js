const { parentPort, workerData } = require('worker_threads');
const Header = require('../models/header');

function findMeta(data) {
  const { headerData, timeout } = data;

  const header = Header.fromObject(headerData);
  const start = Date.now();

  header.randomizeMeta();

  while ((Date.now() - start) < timeout) {
    header.setHash(header.computeHash());

    if (header.verifyHash(false)) {
      return header.getMeta();
    }

    header.randomizeMeta();
  }

  return null;
}

parentPort.postMessage(findMeta(workerData));
