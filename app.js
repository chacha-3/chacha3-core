const http = require('http');

const fastify = require('fastify');

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

function build(opts={}) {
  const app = fastify(opts);
  app.register(require('fastify-websocket'));
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
    console.log(connection);
    connection.socket.on('message', message => {
      console.log(message);
      console.log('hi');
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
      console.log('handler2');
      return { hello: 'world2' };
    },
  });

  return app;
}

module.exports = build;
