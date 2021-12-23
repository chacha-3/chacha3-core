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
        return;
      }

      const { port, chainWork, chainLength } = Peer.parseRequestHeaders(request);

      if (!port) {
        return;
      }

      const { ip } = request;

      const { action, nonce } = request.body;
      const reachOutSelf = action === 'nodeInfo' && nonce === Peer.localNonce;

      if (reachOutSelf) {
        return;
      }

      const peer = await Peer.discoverNewOrExisting(ip, port);
      peer.setTotalWork(chainWork);
      peer.setChainLength(chainLength);

      const syncActions = ['nodeInfo', 'pushBlock'];

      if (syncActions.includes(action) && peer.isSignificantlyAhead()) {
        debug('Sync with chain significantly ahead');

        peer.syncChain();
        // TODO: Add claimed work to verify is correct
        // TODO: If sync fail. Find next best
      }
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
