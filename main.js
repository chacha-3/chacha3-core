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

  Chain.mainChain = await Chain.load();
  console.log(Chain.mainChain);
  await Peer.reachOutAll();

  // Sync with longest chain
  const peerPriority = await Peer.withLongestActiveChains();
  debug(`Peer priority: ${peerPriority[0].getAddress()}:${peerPriority[0].getPort()}`);

  // Check active
  for (let i = 0; i < peerPriority.length; i += 1) {
    const connectPeer = peerPriority[i];
    debug(`Connecting to peer: ${peerPriority[i].getAddress()}:${peerPriority[i].getPort()}`);

    const { data } = await connectPeer.callAction('pullChain');

    const pulledChain = Chain.fromObject(data);
    const divergeIndex = Chain.compareWork(Chain.mainChain, pulledChain);

    let valid = true;
    debug(`Diverge index: ${divergeIndex}. Pulled chain length: ${pulledChain.getLength()}`);
    for (let j = divergeIndex; j < pulledChain.getLength() && j >= 0 && valid; j += 1) {
      const header = pulledChain.getBlockHeader(j);

      debug(`Request block data: ${header.getHash().toString('hex')}`);
      debug(`Peer info: ${connectPeer.getAddress()}:${connectPeer.getPort()}`);
      const { data } = await connectPeer.callAction('blockInfo', { hash: header.getHash().toString('hex') });
      debug(`Receive new block data: ${header.getHash().toString('hex')}`);
      if (data) {
        debug('Receive data for block');
        const block = Block.fromObject(data);

        if (block.verify()) {
          const { key } = await Block.save(block);
          debug(`Saved new block: ${key.toString('hex')}`);
        } else {
          debug('Block not valid');
          valid = false;
        }
      } else {
        debug('No data');
      }
    }

    debug('Done getting block infos');

    if (valid) {
      debug('Chain up to latest');
      await Chain.save(pulledChain);
      break;
    } else {
      debug('Invalid chain');
    }
  }
});

ipc.server.start();
