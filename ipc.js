const ipc = require('node-ipc');
const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false }); // No coerce for server

const { routeAction } = require('./actions');

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

        const response = await routeAction(options);
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

module.exports = ipc;
