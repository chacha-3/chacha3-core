const blake3 = require('blake3-wasm');
const { parentPort, workerData } = require('worker_threads');

function doHash() {
  // let hash = blake3.hash();

  // let nonce = Math.floor((Math.random() * 10000000) + 1);

  // const startTime = Date.now();
  // do {
  //   nonce += 1;
  //   hash = blake3.hash(nonce.toString());

  //   if (hash[0] === 0x00 && hash[1] === 0x00) {
  //     return hash.toString('hex');
  //   }
  // } while ((Date.now() - startTime) < 100);

  return null;
}

parentPort.postMessage(doHash());
