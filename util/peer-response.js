const assert = require('assert');
const { SuccessCode } = require('./rpc');

const HOST_127_0_0_100 = '127.0.0.100';
const HOST_127_0_0_101 = '127.0.0.101';

const PORT_7000 = 7000;

const responseList = [
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'nodeInfo',
    response: {
      data: {
        version: '0.0.1',
        time: 1636425419080,
        port: '3000',
        chainLength: 1,
        chainWork: 1,
        nonce: 3634909521917696,
      },
      code: SuccessCode,
    },
  },
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'listPeers',
    response: {
      data: [
        {
          host: '127.0.0.100',
          port: '6000',
          version: null,
          chainLength: null,
          chainWork: 0,
          status: 'unreachable',
        },
        {
          host: '127.0.0.100',
          port: '6001',
          version: null,
          chainLength: null,
          chainWork: 0,
          status: 'unreachable',
        },
      ],
      code: SuccessCode,
    },
  },
  // Valid chain
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: [
          {
            hash: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
            time: 1632270111948,
            difficulty: 1,
            nonce: 4040180215728735,
            checksum: '0x635297f915d116d235ccfea6d6d671826ca176231860e569c0b96448b284c689',
            version: 1,
          },
          {
            hash: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
            previous: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            time: 1636604961006,
            difficulty: 1,
            nonce: 5990812823041010,
            checksum: '0x72274285f728bd151e9700c4494ea2cd26c58abaccf077b54fcd93a586b9c2af',
            version: 1,
          },
          {
            hash: '0x0036768ee27e38856b37c61a612f05ec60047ce18657648b75f23c7554f81fdf',
            previous: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
            time: 1636604961029,
            difficulty: 1,
            nonce: 7689427402555930,
            checksum: '0xa851b114d7d7ffab019d8edc2790e2da6055a60e5d84e586087f4c300be9cff0',
            version: 1,
          },
        ],
      },
      message: SuccessCode,
    },
  },
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
    },
    response: {
      data: {
        header: {
          hash: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
          previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
          time: 1632270111948,
          difficulty: 1,
          nonce: 4040180215728735,
          checksum: '0x635297f915d116d235ccfea6d6d671826ca176231860e569c0b96448b284c689',
          version: 1,
        },
        transactions: [
          {
            id: '0x412d59e9a4898e3ef2d593b7db27764baed004ac088e5b22d6986b200bcb427b',
            version: 1,
            senderKey: null,
            receiverAddress: '0x00cec242aee336e190cef0e18bb149db99b0069fdf6964ed57',
            amount: '5000000n',
            signature: null,
            time: 1632270111949,
          },
        ],
      },
      code: SuccessCode,
    },
  },
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
    },
    response: {
      data: {
        header: {
          hash: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
          previous: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
          time: 1636604961006,
          difficulty: 1,
          nonce: 5990812823041010,
          checksum: '0x72274285f728bd151e9700c4494ea2cd26c58abaccf077b54fcd93a586b9c2af',
          version: 1,
        },
        transactions: [
          {
            id: '0x2ea9fca9201e044497b09d7c63ce5a1747a519cea27b89f95c4e2f53fc3e3085',
            version: 1,
            senderKey: null,
            receiverAddress: '0x008ecc21103c9c5b609c4e9c52e4a8e676f14d98fa02527b05',
            amount: '5000000n',
            signature: null,
            time: 1636604961006,
            type: 'mine',
          },
        ],
      },
      code: SuccessCode,
    },
  },
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: '0x0036768ee27e38856b37c61a612f05ec60047ce18657648b75f23c7554f81fdf',
    },
    response: {
      data: {
        header: {
          hash: '0x0036768ee27e38856b37c61a612f05ec60047ce18657648b75f23c7554f81fdf',
          previous: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
          time: 1636604961029,
          difficulty: 1,
          nonce: 7689427402555930,
          checksum: '0xa851b114d7d7ffab019d8edc2790e2da6055a60e5d84e586087f4c300be9cff0',
          version: 1,
        },
        transactions: [
          {
            id: '0xe0ce92bc7051e2bf6191a074d912742f8199e4ce66a2d283cee869c2833b257a',
            version: 1,
            senderKey: null,
            receiverAddress: '0x008ecc21103c9c5b609c4e9c52e4a8e676f14d98fa02527b05',
            amount: '5000000n',
            signature: null,
            time: 1636604961029,
            type: 'mine',
          },
        ],
      },
      code: SuccessCode,
    },
  },
  // Invalid chain
  {
    host: HOST_127_0_0_101,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: [
          {
            hash: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
            time: 1632270111948,
            difficulty: 1,
            nonce: 4040180215728735,
            checksum: '0x635297f915d116d235ccfea6d6d671826ca176231860e569c0b96448b284c689',
            version: 1,
          },
          {
            hash: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
            previous: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            time: 1636604961006,
            difficulty: 1,
            nonce: 5990812823041010,
            checksum: '0x72274285f728bd151e9700c4494ea2cd26c58abaccf077b54fcd93a586b9c2af',
            version: 1,
          },
          {
            hash: '0x000f4edfc8f26bce7db1720c33af949e3302d0a085932ee53e176b05465232fd',
            previous: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
            time: 1636604961029,
            difficulty: 1,
            nonce: 7689427402555930,
            checksum: '0xa851b114d7d7ffab019d8edc2790e2da6055a60e5d84e586087f4c300be9cff0',
            version: 1,
          },
        ],
      },
      message: SuccessCode,
    },
  },
  // Invalid hash
  {
    host: HOST_127_0_0_101,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: '0x000f4edfc8f26bce7db1720c33af949e3302d0a085932ee53e176b05465232fd',
    },
    response: {
      data: {
        header: {
          hash: '0x0036768ee27e38856b37c61a612f05ec60047ce18657648b75f23c7554f81fdf',
          previous: '0x007fb4b7770d392584cb22b6ba5d77b75d23bd112c285ac806f66f2d78c86cc3',
          time: 1636604961029,
          difficulty: 1,
          nonce: 7689427402555930,
          checksum: '0xa851b114d7d7ffab019d8edc2790e2da6055a60e5d84e586087f4c300be9cff0',
          version: 1,
        },
        transactions: [
          {
            id: '0xe0ce92bc7051e2bf6191a074d912742f8199e4ce66a2d283cee869c2833b257a',
            version: 1,
            senderKey: null,
            receiverAddress: '0x008ecc21103c9c5b609c4e9c52e4a8e676f14d98fa02527b05',
            amount: '5000000n',
            signature: null,
            time: 1636604961029,
            type: 'mine',
          },
        ],
      },
      code: SuccessCode,
    },
  },
];

const sendTestRequest = (host, port, options) => {
  const { action } = options;
  assert(action);

  const item = responseList.find((i) => {
    if (i.host !== host) {
      return false;
    }

    if (i.port !== port) {
      return false;
    }

    if (i.action !== action) {
      return false;
    }

    if (i.options) {
      const keys = Object.keys(i.options);
      const { length } = keys;

      for (let x = 0; x < length; x += 1) {
        if (i.options[keys[x]] !== options[keys[x]]) {
          return false;
        }
      }
    }

    return true;
  });

  if (item === undefined) {
    return null;
  }

  return JSON.stringify(item.response);
};

module.exports = {
  HOST_127_0_0_100,
  HOST_127_0_0_101,
  PORT_7000,
  sendTestRequest,
};
