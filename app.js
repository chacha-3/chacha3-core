const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Peer = require('./models/peer');

const { runAction, checkPermission } = require('./actions');

const errorHandler = (error, request, reply) => {
  reply.send({ message: error.message, code: 'internal' });
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
      // TODO: maybe
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      const response = await runAction(request.body, 'none');
      reply.send(response);
    },
  });

  return app;
}

module.exports = build;
