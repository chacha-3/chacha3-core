const debug = require('debug')('app');
const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Peer = require('./models/peer');

const { runAction, checkPermission, actionList } = require('./actions');

const { errorResponse, ErrorCode } = require('./util/rpc');

const errorHandler = (error, request, reply) => {
  console.log(error);
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
        return done();
      }

      const port = request.headers['bong-port'];

      if (!port) {
        return done();
      }

      const { ip } = request;
      const key = Peer.generateKey(ip, port);

      const peer = await Peer.load(key);

      if (!peer) {
        const newPeer = new Peer(ip, port);
        newPeer.reachOut();
      } else if (peer && peer.status !== Peer.Status.Active) {
        peer.reachOut();
      }
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
