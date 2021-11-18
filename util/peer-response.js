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
    previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
    time: 1636894589652,
    difficulty: 1,
    nonce: 1636681633461,
    checksum: '0x4705a4553646b43f16351241d9af8534c6172363d5f2bfbd1f93dd05a0a96baa',
    version: 1,
  },
  transactions: [
    {
      id: '0x32c74847cbfeaf45ad68b1c14d7c6d678f2e76402b908fcb67f3d954c7d54b2c',
      version: 1,
      senderKey: null,
      receiverAddress: '0x003aaf53fe2f752f540e4f0bcc6262d5b06b0c3b542a958952',
      amount: '5000000n',
      signature: null,
      time: 1636681633455,
      type: 'mine',
    },
  ],
};

const unverifiedChainData = () => {
  const headerData = headers.slice(0, 2);
  headerData.push(unverifiedBlock.header);

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
            hash: '0x00511c7df060d3321a3da06b63fe1e6785f89a639796899c2ea5f85d9b5fd6f9',
            previous: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1',
            time: 1636681633454,
            difficulty: 1,
            nonce: 8314141122264957,
            checksum: '0x408e7935f009c68bf30a54e62966cc214ebe47d1b78ef3caca32c56a7273e824',
            version: 1,
          },
          {
            hash: '0x00c62eb8109cc1cbd947ed53d7755ba25611e5b2171d8930f5f451ab86f0c3e4',
            // Invalid previous hash
            previous: '0x0000000000000000000000000000000000000000000000000000000000000000',
            time: 1636681633461,
            difficulty: 1,
            nonce: 5220927076187582,
            checksum: '0xb9d7829ae3da146c71d0589df961fbb983b490d564ec0bcfc8618c490002dbe3',
            version: 1,
          },
        ],
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
