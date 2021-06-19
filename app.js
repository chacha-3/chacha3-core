const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Peer = require('./models/peer');

const actions = require('./actions');

const schema = {
  body: {
    action: { type: 'string' },
  },
};

const router = async (request, reply) => {
  const { action } = request.body;
  const { handler } = await actions[action];

  handler(request, reply);
};

const errorHandler = (error, request, reply) => {
  console.log(error);
  if (error.validation) {
    reply.status(400).send(error.validation);
    return;
  }

  reply.send({ error: 'errorHandler' });
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
    preHandler: async (request, reply, done) => {
      const actionName = request.body.action;
      const action = actions[actionName];

      if (!action) {
        reply.code(400).send();
      }

      const { permission } = action;

      if (permission === 'public') {
        done();
      }

      if (permission === 'authOnly') {
        reply.code(401);
      }
      // E.g. check authentication
      // reply.code(401);
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      const actionName = request.body.action;
      const action = actions[actionName];

      const { handler } = action;

      handler(request, reply);
    },
  });

  return app;
}

module.exports = build;
