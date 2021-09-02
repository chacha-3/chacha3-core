require('dotenv').config();

const debug = require('debug')('main');
const server = require('./server');
const ipc = require('./ipc');

const Peer = require('./models/peer');
const Chain = require('./models/chain');
const Block = require('./models/block');
const { mainChain } = require('./models/chain');
// const { verifyAndSave } = require('./models/block');

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

  Chain.mainChain = await Chain.load();
  await Peer.reachOutAll();

  // Sync with longest chain
  const peerPriority = await Peer.withLongestActiveChains();
  debug(`Peer priority: ${peerPriority[0].getAddress()}:${peerPriority[0].getPort()}`);

  // Check active
  for (let i = 0; i < peerPriority.length; i += 1) {
    const connectPeer = peerPriority[i];
    debug(`Connecting to peer: ${peerPriority[i].getAddress()}:${peerPriority[i].getPort()}`);

    // const { data } = await connectPeer.callAction('pullChain');

    // const pulledChain = Chain.fromObject(data);
    // const divergeIndex = Chain.compareWork(Chain.mainChain, pulledChain);

    const valid = await Chain.syncWithPeer(connectPeer);

    debug('Done chain synchronization');

  }
});

ipc.server.start();
