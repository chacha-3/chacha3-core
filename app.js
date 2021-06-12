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
      type: 'object',
      properties: {
        hello: { type: 'string' },
      },
    },
  },
};

const peerList = [];

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
    connection.socket.on('message', (message) => {
      const request = JSON.parse(message);
      const { action } = request;

      const response = JSON.stringify(actions[action](request));
      connection.socket.send(response);
    });
  });

  // RPC endpoint
  app.post('/', {
    schema,
    preHandler: async (request, reply) => {
      // E.g. check authentication
    },
    handler: async (request, reply) => {
      // console.log(request);
      return { hello: 'world2' };
    },
  });

  return app;
}

module.exports = build;
