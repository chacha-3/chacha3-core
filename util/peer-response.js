const assert = require('assert');
const { SuccessCode } = require('./rpc');

const HOST_127_0_0_100 = '127.0.0.100';
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
            hash: '0x00f79d217073336af9ac38f7ea7c56ce02f4013d6da0b1a7930a12ff9655b565',
            previous: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            time: 1636436793309,
            difficulty: 1,
            nonce: 3611294215922777,
            checksum: '0x32ecbce7532639f841fbd236539a6772fcc3dd6f2d89efd0b3d55feebfa81bc7',
            version: 1,
          },
          {
            hash: '0x00c51b881d220fb9236b42eae2cca90ee1ed091df673792cf6722d02c47f2362',
            previous: '0x00f79d217073336af9ac38f7ea7c56ce02f4013d6da0b1a7930a12ff9655b565',
            time: 1636436793360,
            difficulty: 1,
            nonce: 8886981442609112,
            checksum: '0xe34b45eca09b405dbde07e2d5c9152ef328232b8ba6cdc026079aae9a2609235',
            version: 1,
          },
        ],
      },
      message: SuccessCode,
    },
  },
];

const sendTestRequest = (host, port, options) => {
  const { action } = options;
  assert(action);

  const item = responseList.find((i) => i.host === host && i.port === port && i.action === action);

  if (item === undefined) {
    return null;
  }

  return JSON.stringify(item.response);
};

module.exports = {
  HOST_127_0_0_100,
  PORT_7000,
  sendTestRequest,
};
