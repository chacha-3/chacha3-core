require('dotenv').config();

const debug = require('debug')('main');
const server = require('./server');
const ipc = require('./ipc');

const Peer = require('./models/peer');
const Chain = require('./models/chain');

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
  const mostWorkPeer = await Peer.withMostTotalWork();
  console.log(mostWorkPeer);
  const chainData = await mostWorkPeer.callAction('pullChain');

  console.log(chainData);
  const pulledChain = Chain.fromObject(chainData);

  console.log(pulledChain);
  // Chain.compareWork(Chain.mainChain, )
});

ipc.server.start();
