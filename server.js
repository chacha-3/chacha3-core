/**
 * Normalize a port into a number, string, or false.
 */
const selfsigned = require('selfsigned');
const ipc = require('node-ipc');
const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const Block = require('./models/block');
const Chain = require('./models/chain');

const actions = require('./actions');

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

const attrs = [{ name: 'commonName', value: 'bong' }];
const pems = selfsigned.generate(attrs, {
  keySize: 2048,
  days: 530,
  algorithm: 'sha256',
});

const server = require('./app')({
  // logger: {
  //   level: 'info',
  //   prettyPrint: true,
  // },
  http2: false,
  https: {
    key: pems.private,
    cert: pems.cert,
  },
});

const port = normalizePort(process.env.PORT || '3000');

server.listen(port, async (err, address) => {
  // runMiner();
  console.log(`Server started ${address}`);
  if (err) {
    // Block.clearAll();
    process.exit(1);
  }
});

ipc.config.id = 'world';
ipc.config.retry = 1500;
// ipc.config.silent = true;

ipc.serve(
  () => {
    ipc.server.on(
      'message',
      async (request, socket) => {
        // ipc.log('got a message : '.debug, data);
        const options = JSON.parse(request);

        const actionName = options.action;
        const action = actions[actionName];

        if (!action) {
          ipc.server.emit(
            socket,
            'message', // this can be anything you want so long as
            // your client knows.
            JSON.stringify({ code: 'unimplemented', message: 'Action not available' }),
          );
        }

        const { schema, handler } = action;

        // console.log(data);

        if (schema) {
          const validate = ajv.compile(schema);

          if (!validate(options)) {
            const message = { errors: [validate.errors[0].message], code: 'invalid_argument', message: 'Invalid argument' };

            ipc.server.emit(
              socket,
              'message', // this can be anything you want so long as
              // your client knows.
              JSON.stringify(message),
            );
          }
        }

        const {
          data, code, errors, message,
        } = await handler(request.body);

        let response;
        if (code !== 'ok') {
          response = { errors, code, message };
        } else {
          response = { data, code, message };
        }

        ipc.server.emit(
          socket,
          'message', // this can be anything you want so long as
          // your client knows.
          JSON.stringify(response),
        );
      },
    );
    ipc.server.on(
      'socket.disconnected',
      (socket, destroyedSocketID) => {
        ipc.log(`client ${destroyedSocketID} has disconnected!`);
      },
    );
  },
);

ipc.server.start();

module.exports = server;
