const crypto = require('crypto');
const debug = require('debug')('app');
const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Peer = require('./models/peer');

const { runAction } = require('./actions');

const { errorResponse, ErrorCode } = require('./util/rpc');
const { isTestEnvironment } = require('./util/env');

const errorHandler = (error, request, reply) => {
  reply.send(errorResponse(ErrorCode.Internal, error.message));
};

const isReachingOutSelf = (options) => {
  const { action, nonce } = options;
  return action === 'nodeInfo' && nonce === Peer.localNonce;
};

const discoverAndSync = async (request) => {
  const {
    host, port, chainWork, chainLength,
  } = Peer.parseRequestHeaders(request);

  // Non-public node. Skip the discovery
  if (!host || host === '' || isReachingOutSelf(request.body)) {
    return;
  }

  const [peer] = await Peer.loadOrDiscover(host, port);
  peer.setTotalWork(chainWork);
  peer.setChainLength(chainLength);

  const syncActions = ['nodeInfo', 'pushBlock'];

  const { action } = request.body;

  if (syncActions.includes(action) && peer.isSignificantlyAhead()) {
    debug('Sync with chain significantly ahead');

    peer.syncChain();
    // TODO: Add claimed work to verify is correct
  }
};

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);
  app.setErrorHandler(errorHandler);

  app.route({
    method: 'GET',
    url: '/',
    handler: (req, reply) => {
      // this will handle http requests
      reply.send({ message: 'Welcome to ChaCha3!' });
    },
    // wsHandler: async (connection) => {
    //   const id = crypto.randomBytes(4).toString('hex');
    //   Peer.addSocketListener(id, connection);

    //   const response = await runAction({ action: 'nodeInfo' }, 'none');
    //   connection.socket.send(JSON.stringify(response));

    //   connection.socket.on('message', (message) => {
    //     let data;

    //     try {
    //       data = JSON.parse(message);
    //     } catch (e) {
    //       return;
    //     }

    //     const { listenActions } = data;

    //     Peer.setSocketListenActions(id, listenActions);
    //   });
    // },
  });

  // RPC endpoint
  app.post('/', {
    preHandler: async (request) => {
      // if (isTestEnvironment) {
      //   return;
      // }

      discoverAndSync(request);
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      debug(`Request receive: ${JSON.stringify(request.body)}}`);
      const response = await runAction(request.body, 'none');

      reply.send(response);
    },
  });

  return app;
}

module.exports = build;
