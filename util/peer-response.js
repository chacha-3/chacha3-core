const assert = require('assert');
const { SuccessCode } = require('./rpc');

const blockData = require('./mock/data/blocks.json');
const unverifiedBlockData = require('./mock/data/unverified-block.json');
const invalidBlockData = require('./mock/data/invalid-block.json');

const HOST_ANY = '*';
const HOST_127_0_0_99 = '127.0.0.99';
const HOST_127_0_0_100 = '127.0.0.100';
const HOST_127_0_0_101 = '127.0.0.101';
const HOST_127_0_0_200 = '127.0.0.200';

const PORT_7000 = 7000;

const headers = blockData.map((block) => block.header);

// const unverifiedHash = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00;

// const unverifiedBlock = {
//   header: {
//     hash: unverifiedHash,
//     previous: null,
//     time: 1637902963395,
//     difficulty: 1,
//     nonce: 8609437805620442,
//     checksum: '0x385deec3656ac30a97d5b37837732214c0175950073f08aaffc095470eabd876',
//     version: 1,
//   },
//   transactions: [
//     {
//       id: '0x142f7bb983445793a031aed7e241a48efa74dbdd70d3d0ed74404485fc96ba05',
//       version: 1,
//       senderKey: null,
//       receiverAddress: '0x00cc460a150ce94fe032e806d586fc84ec515dc12ed934743b',
//       amount: '5000000n',
//       signature: null,
//       time: 1637902963396,
//       type: 'mine',
//     },
//   ],
// };

// const invalidBlock = { ...blockData[3] };
// invalidBlock.header.previous = blockData[8].header.previous;

// const unverifiedChainData = () => {
//   const headerData = headers.slice(0, 2);
//   unverifiedBlock.header.previous = headers[1].hash;

//   headerData.push(unverifiedBlock.header);

//   return headerData;
// };

// const invalidChain = () => {
//   const headerData = headers.slice(0, 2);
//   const block = { ...invalidBlock };

//   headerData.push(block.header);

//   return headerData;
// };

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
        blockHeaders: unverifiedBlockData.map((block) => block.header),
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
        blockHeaders: invalidBlockData.map((blocks) => blocks.header),
      },
      message: SuccessCode,
    },
  },
  // Invalid previous hash
  {
    host: HOST_ANY,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: invalidBlockData[2].header.hash,
    },
    response: {
      data: {
        header: invalidBlockData[2],
      },
      code: SuccessCode,
    },
  },
  // Invalid hash target
  {
    host: HOST_ANY,
    port: PORT_7000,
    action: 'blockInfo',
    options: {
      hash: unverifiedBlockData[2].header.hash,
    },
    response: {
      data: unverifiedBlockData[2],
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
