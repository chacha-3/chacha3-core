/**
 * Normalize a port into a number, string, or false.
 */
const selfsigned = require('selfsigned');
const ipc = require('node-ipc');

const Block = require('./models/block');

const Chain = require('./models/chain');

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

// TODO: Peer list
const runMiner = async () => {
  // TODO: Remove
  await Chain.clear();

  const mining = true;
  const chain = await Chain.load();
  console.log(`Miner started. Current height: ${chain.getLength()}. Current total work: ${chain.getTotalWork()}`);

  while (mining) {
    const block = new Block();
    block.addCoinbase('1Ah75Y9e93DBWSqGMEBHRBgDMmje4CFv2C');
    const mineTime = await block.mine(chain.getCurrentDifficulty());

    console.log(`New block mined ${block.getHeader().getHash().toString('hex')}. Time: ${mineTime}. Nonce: ${block.getHeader().getNonce()}, Difficulty: ${chain.getCurrentDifficulty()}`);

    Block.save(block);
    chain.addBlockHeader(block.getHeader());

    console.log(`New block saved. Current height: ${chain.getLength()}. Current total work: ${chain.getTotalWork()}`);
    Chain.save(chain);
  }
};

const attrs = [{ name: 'commonName', value: 'bong' }];
const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  days: 530,
  algorithm: 'sha256',
});

const server = require('./app')({
  // logger: {
  //   level: 'info',
  //   prettyPrint: true,
  // },
  http2: false,
  https: {
    key: pems.private,
    cert: pems.cert,
  },
});

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, async (err, address) => {
  // runMiner();
  console.log(`Server started ${address}`);
  if (err) {
    // Block.clearAll();
    process.exit(1);
  }
});

ipc.config.id = 'world';
ipc.config.retry = 1500;
// ipc.config.silent = true;

ipc.serve(
  () => {
    ipc.server.on(
      'message',
      (data, socket) => {
        // ipc.log('got a message : '.debug, data);
        ipc.server.emit(
          socket,
          'message', // this can be anything you want so long as
          // your client knows.
          `${data} world!`,
        );
      },
    );
    ipc.server.on(
      'socket.disconnected',
      (socket, destroyedSocketID) => {
        ipc.log(`client ${destroyedSocketID} has disconnected!`);
      },
    );
  },
);

ipc.server.start();

module.exports = server;
