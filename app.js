const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Peer = require('./models/peer');

const { runAction } = require('./actions');

const errorHandler = (error, request, reply) => {
  console.log(error);
  if (error.validation) {
    reply.status(400).send(error.validation);
    return;
  }

  reply.send({ message: 'errorHandler' });
};

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);
  app.setErrorHandler(errorHandler);

  // Websocket endpoint
  app.get('/', {
    websocket: true,
    // schema,
  }, (connection, req) => {
    console.log('connect');
    connection.socket.on('message', (message) => {
      const requestData = JSON.parse(message);
      connection.socket.send(requestData);
    });
  });

  // RPC endpoint
  app.post('/', {
    preHandler: async (request, reply, done) => {
      // const { permission, schema } = action;
      // // if (permission === 'public') {
      // //   done();
      // // }

      // if (permission === 'authOnly') {
      //   reply.send({ code: 'unauthenticated', message: 'Auth required' });
      // }
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      const response = await runAction(request.body, 'auth');
      reply.send(response);
    },
  });

  return app;
}

module.exports = build;
