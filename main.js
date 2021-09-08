require('dotenv').config();

const debug = require('debug')('main');
const server = require('./server');
const ipc = require('./ipc');

const Peer = require('./models/peer');
const Chain = require('./models/chain');
const Block = require('./models/block');
const { mainChain } = require('./models/chain');

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, async (err) => {
  debug(`Server listening on port ${port}`);
  if (err) {
    console.log(err);
    process.exit(1);
  }

  await Chain.initializeGenesisBlock();

  Chain.mainChain = await Chain.load();
  await Peer.reachOutAll();

  // Sync with longest chain
  const peerPriority = await Peer.withLongestActiveChains();

  // Check active
  for (let i = 0; i < peerPriority.length; i += 1) {
    const connectPeer = peerPriority[i];
    debug(`Connecting to peer: ${peerPriority[i].getAddress()}:${peerPriority[i].getPort()}`);

    // const success = await Chain.syncWithPeer(connectPeer);
    const success = await connectPeer.syncChain();

    if (success) {
      debug(`Chain is valid: ${success}. Synced with peer ${peerPriority[i].getAddress()}:${peerPriority[i].getPort()}`);
      break;
    }
  }
});

ipc.server.start();
