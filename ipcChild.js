const ipc = require('node-ipc');

ipc.config.id = 'hello';
ipc.config.retry = 1500;

ipc.connectTo(
  'world',
  () => {
    ipc.of.world.on(
      'connect',
      () => {
        // ipc.log('## connected to world ##'.rainbow, ipc.config.delay);
        ipc.of.world.emit(
          'message', // any event or message type your server listens for
          'hello',
        );
      },
    );
    ipc.of.world.on(
      'disconnect',
      () => {
        // ipc.log('disconnected from world'.notice);
      },
    );
    ipc.of.world.on(
      'message', // any event or message type your server listens for
      (data) => {
        // ipc.log('got a message from world : '.debug, data);
      },
    );
  },
);
