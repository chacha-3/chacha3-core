const assert = require('assert');
const { SuccessCode } = require('./rpc');

const blockData = require('./mock/data/blocks.json');

const HOST_ANY = '*';
const HOST_127_0_0_99 = '127.0.0.99';
const HOST_127_0_0_100 = '127.0.0.100';
const HOST_127_0_0_101 = '127.0.0.101';
const HOST_127_0_0_200 = '127.0.0.200';

const PORT_7000 = 7000;

const headers = blockData.map((block) => block.header);

const unverifiedBlock = {
  header: {
    hash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00',
    previous: null,
    time: 1637902963395,
    difficulty: 1,
    nonce: 8609437805620442,
    checksum: '0x385deec3656ac30a97d5b37837732214c0175950073f08aaffc095470eabd876',
    version: 1,
  },
  transactions: [
    {
      id: '0x142f7bb983445793a031aed7e241a48efa74dbdd70d3d0ed74404485fc96ba05',
      version: 1,
      senderKey: null,
      receiverAddress: '0x00cc460a150ce94fe032e806d586fc84ec515dc12ed934743b',
      amount: '5000000n',
      signature: null,
      time: 1637902963396,
      type: 'mine',
    },
  ],
};

const unverifiedChainData = () => {
  const headerData = headers.slice(0, 2);
  headerData.push(unverifiedBlock.header);

  return headerData;
};

const invalidChain = () => {
  const headerData = headers.slice(0, 3);
  headerData[2].previous = '0xffffff00000000000000000000000000000000000000000000000000000000ff';

  return headerData;
};

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
        nonce: 3000000,
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
  // Shorter chain
  {
    host: HOST_127_0_0_99,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: headers.slice(0, 2),
      },
      message: SuccessCode,
    },
  },
  // Valid chain
  {
    host: HOST_127_0_0_100,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: headers.slice(0, 3),
      },
      message: SuccessCode,
    },
  },
  // Unverified chain
  {
    host: HOST_127_0_0_200,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: unverifiedChainData(),
      },
      message: SuccessCode,
    },
  },
  {
    host: HOST_ANY,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: headers[0].hash,
    },
    response: {
      data: blockData[0],
      code: SuccessCode,
    },
  },
  {
    host: HOST_ANY,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: headers[1].hash,
    },
    response: {
      data: blockData[1],
      code: SuccessCode,
    },
  },
  {
    host: HOST_ANY,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: headers[2].hash,
    },
    response: {
      data: blockData[2],
      code: SuccessCode,
    },
  },
  // Invalid chain (previous block)
  {
    host: HOST_127_0_0_101,
    port: PORT_7000,
    action: 'pullChain',
    response: {
      data: {
        blockHeaders: invalidChain(),
      },
      message: SuccessCode,
    },
  },
  // Invalid previous hash
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
          hash: '0x000f4edfc8f26bce7db1720c33af949e3302d0a085932ee53e176b05465232fd',
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
  // Invalid hash target
  {
    host: HOST_127_0_0_200,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: unverifiedBlock.header.hash,
    },
    response: {
      data: unverifiedBlock,
      code: SuccessCode,
    },
  },
];

const sendTestRequest = (host, port, options) => {
  const { action } = options;
  assert(action);

  const item = responseList.find((i) => {
    if (i.host !== HOST_ANY && i.host !== host) {
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
  HOST_127_0_0_99,
  HOST_127_0_0_100,
  HOST_127_0_0_101,
  HOST_127_0_0_200,
  PORT_7000,
  sendTestRequest,
  headers,
};
