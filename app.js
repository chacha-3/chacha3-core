const fastify = require('fastify');
const fastifyWebsocket = require('fastify-websocket');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Peer = require('./models/peer');

const actions = require('./actions');

// const schema = {
//   body: {
//     action: { type: 'string' },
//   },
// };

// const router = async (request, reply) => {
//   const { action } = request.body;
//   const { handler } = await actions[action];

//   handler(request, reply);
// };

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
    // schema,
    // preValidation: (request, reply, done) => {
    //   // console.log(request);
    // },
    preHandler: async (request, reply, done) => {
      const actionName = request.body.action;
      const action = actions[actionName];

      if (!action) {
        reply.send({ code: 'unimplemented', message: 'Action not available' });
      }

      const { permission, schema } = action;
      // if (permission === 'public') {
      //   done();
      // }

      if (permission === 'authOnly') {
        reply.send({ code: 'unauthenticated', message: 'Auth required' });
      }

      if (schema) {
        const validate = ajv.compile(schema);

        if (!validate(request.body)) {
          reply.send({ errors: [validate.errors[0].message], code: 'invalid_argument', message: 'Invalid argument' });
          done();
        }
      }

      // TODO: Verify action params

      // E.g. check authentication
      // reply.code(401);
    },
    handler: async (request, reply) => {
      reply.type('application/json');

      const actionName = request.body.action;
      const action = actions[actionName];

      const { handler } = action;

      const {
        data, code, errors, message,
      } = await handler(request.body);

      if (code !== 'ok') {
        reply.send(JSON.stringify({ errors, code, message }));
      } else {
        reply.send(JSON.stringify({ data, code, message }));
      }
    },
  });

  return app;
}

module.exports = build;
