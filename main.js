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
  await Peer.reachOutAll();

  // Sync with longest chain
  const peer = await Peer.withLongestActiveChains()[0];
  console.log(peer);

  // Check active
  if (peer) {
    const { data } = await peer.callAction('pullChain');

    const pulledChain = Chain.fromObject(data);

    console.log(mainChain);
    const divergeIndex = Chain.compareWork(Chain.mainChain, pulledChain);

    let valid = true;

    for (let i = divergeIndex; i < pulledChain.getLength(); i += 1) {
      const header = pulledChain.getBlockHeader(i);

      debug(`Request block data: ${header.getHash().toString('hex')}`);
      debug(`Peer info: ${peer.getAddress()}:${peer.getPort()}`);
      const { data } = await peer.callAction('blockInfo', { hash: header.getHash().toString('hex') });
      debug(`Receive new block data: ${header.getHash().toString('hex')}`);
      if (data) {
        debug('Receive data for block');
        const block = Block.fromObject(data);

        if (block.verify()) {
          debug(`Saved new block: ${header.getHash().toString('hex')}`);
          await Block.save(block);
        } else {
          debug('Block not valid');
          valid = false;
          break;
        }
      } else {
        debug('No data');
      }
    }

    if (valid) {
      debug('Updated to new chain');
      await Chain.save(pulledChain);
    } else {
      debug('Invalid chain');
    }
  }
});

ipc.server.start();
