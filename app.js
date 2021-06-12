const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const schema = {
  querystring: {
    name: { type: 'string' },
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

function build(opts = {}) {
  const app = fastify(opts);

  app.register(fastifyWebsocket);

  // Websocket endpoint
  app.get('/', {
    websocket: true,
    schema,
    // preHandler: async (request, reply) => {
    //   // E.g. check authentication
    // },
    // handler: async (request, reply) => {
    //   // return { hello: 'world' };
    // },
  }, (connection, req) => {
    connection.socket.on('message', message => {
      connection.socket.send('hi from server');
    });
  });

  // RPC endpoint
  app.post('/', {
    schema,
    preHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      return { hello: 'world2' };
    },
  });

  return app;
}

module.exports = build;
