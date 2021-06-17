const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Peer = require('./models/peer');

const actions = require('./actions');

const schema = {
  body: {
    action: { type: 'string' },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        hello: { type: 'string' },
      },
    },
  },
};

const mapRequestAction = async (request) => {
  const { action } = request;

  const handler = await actions[action];
  if (!handler) {
    return false;
  }

  return handler(request);
};

const errorHandler = (error, request, reply) => {
  console.log(error);
  if (error.validation) {
    reply.status(400).send(error.validation);
    return;
  }

  reply.send({'error': 'hello'});
};

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);
  app.setErrorHandler(errorHandler);

  // Websocket endpoint
  app.get('/', {
    websocket: true,
    schema,
  }, (connection, req) => {
    connection.socket.on('message', (message) => {
      const requestData = JSON.parse(message);
      connection.socket.send(requestData);
    });
  });

  // RPC endpoint
  app.post('/', {
    schema,
    preHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      const response = await mapRequestAction(request.body);
      reply.type('application/json');

      if (response) {
        return JSON.stringify(response);
      }

      reply.code(404);
      return JSON.stringify({ error: 'notFound' });
    },
  });

  return app;
}

module.exports = build;
