const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Peer = require('./models/peer');

const actions = require('./actions');

const schema = {
  querystring: {
    action: { type: 'string' },
  },
  response: {
    200: {
      data: 'object',
      properties: {
        hello: { type: 'string' },
      },
    },
  },
};

const mapRequestAction = async (request) => {
  const { action } = request;

  const result = await actions[action](request);
  return JSON.stringify(result);
}

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);

  // Websocket endpoint
  app.get('/', {
    websocket: true,
    schema,
  }, (connection, req) => {
    connection.socket.on('message', (message) => {
      connection.socket.send(mapRequestAction(JSON.parse(message)));
    });
  });

  // RPC endpoint
  app.post('/', {
    schema,
    preHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      const response = await mapRequestAction(request.body);
      return response;
    },
  });

  return app;
}

module.exports = build;
