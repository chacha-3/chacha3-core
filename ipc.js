const ipc = require('node-ipc');
const { runAction } = require('./actions');

ipc.config.id = 'bong';
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.serve(
  () => {
    ipc.server.on(
      'message',
      async (request, socket) => {
        // ipc.log('got a message : '.debug, data);
        const options = JSON.parse(request);

        const response = await runAction(options, 'full');
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
