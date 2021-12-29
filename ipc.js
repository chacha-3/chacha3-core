const debug = require('debug')('ipc');
const ipc = require('node-ipc');
const { runAction } = require('./actions');
const { errorResponse, ErrorCode } = require('./util/rpc');

const ipcId = `chacha3${process.env.PORT || 3000}`;
ipc.config.id = ipcId;

debug(`Config IPC ID: ${ipcId}`);

ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.serve(
  () => {
    ipc.server.on(
      'message',
      async (request, socket) => {
        const options = JSON.parse(request);

        let response;

        try {
          response = await runAction(options, 'full');
        } catch (error) {
          response = errorResponse(ErrorCode.Internal, error.message);
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

module.exports = ipc;
