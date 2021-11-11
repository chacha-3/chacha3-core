const debug = require('debug')('app');
const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Peer = require('./models/peer');

const { runAction, checkPermission, actionList } = require('./actions');

const { errorResponse, ErrorCode } = require('./util/rpc');
const Chain = require('./models/chain');

const errorHandler = (error, request, reply) => {
  reply.send(errorResponse(ErrorCode.Internal, error.message));
};

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);
  app.setErrorHandler(errorHandler);

  // Websocket endpoint
  // app.get('/', {
  //   websocket: true,
  //   // schema,
  // }, (connection, req) => {
  //   connection.socket.on('message', (message) => {
  //     const requestData = JSON.parse(message);
  //     connection.socket.send(requestData);
  //   });
  // });

  // RPC endpoint
  app.post('/', {
    preHandler: async (request, reply, done) => {
      if (process.env.NODE_ENV === 'test') {
        // return done();
        return;
      }

      const port = request.headers['bong-port'];
      const chainWork = request.headers['bong-chain-work'];
      const chainLength = request.headers['bong-chain-length'];

      // TODO: Validate input
      if (!port) {
        // return done();
        return;
      }

      const { ip } = request;
      const key = Peer.generateKey(ip, port);

      const peer = await Peer.load(key);

      const { action, nonce } = request.body;
      const reachOutSelf = action === 'nodeInfo' && nonce === Peer.localNonce;

      // TODO: Move this to nodeInfo action
      if (!peer && !reachOutSelf) {
        const newPeer = new Peer(ip, port);
        newPeer.reachOut();
        return;
        // return done();
      }

      if (peer.status !== Peer.Status.Active && !reachOutSelf) {
        peer.reachOut();
        return;
        // return done();
      }

      const syncActions = ['nodeInfo', 'pushBlock'];

      const threshold = Chain.mainChain.getCurrentDifficulty() * 5;
      const upperThreshold = Chain.mainChain.getTotalWork() + threshold;

      const significantlyAhead = Number.parseInt(chainWork, 10) > upperThreshold;

      debug(`Significantly ahead: ${significantlyAhead}`);

      if (syncActions.includes(actionList) && significantlyAhead) {
        debug('Sync with chain significantly ahead');

        peer.setChainLength(chainLength);
        peer.setTotalWork(chainWork);

        peer.syncChain(); // TODO: Add claimed work to verify is correct
        // TODO: If sync fail. Find next best
      }

      // done();
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      debug(`Request receive: ${JSON.stringify(request.body)}}`);
      // console.log(JSON.stringify(request.body));
      const response = await runAction(request.body, 'none');

      reply.send(response);
    },
  });

  return app;
}

module.exports = build;
