const { test } = require('tap');

const { runningManualTest } = require('../../util/db');
const {
  serializeObject,
  deserializeBuffer,
  serializeBuffer,
  serializeBigInt,
  deserializeBigInt,
} = require('../../util/serialize');
const { okResponse, errorResponse, ErrorCode } = require('../../util/rpc');
const { median } = require('../../util/math');
const mock = require('../../util/mock');
const Chain = require('../../models/chain');

test('detect running unit test', (t) => {
  const argvTest = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\user21\\Projects\\chacha3\\test\\unit\\util.js',
  ];

  const argvNonTest = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\user21\\Projects\\chacha3\\shell.js',
  ];

  t.equal(runningManualTest(argvTest), true);
  t.equal(runningManualTest(argvNonTest), false);
  t.equal(runningManualTest([]), false);

  t.end();
});

test('serialize and deserialize BigInt', (t) => {
  const numbers = [1n, 100000000n, 0n, -220n];
  const results = ['1n', '100000000n', '0n', '-220n'];

  for (let i = 0; i < numbers.length; i += 1) {
    t.equal(serializeBigInt(numbers[i]), results[i]);
  }

  for (let j = 0; j < results.length; j += 1) {
    t.equal(deserializeBigInt(results[j]), numbers[j]);
  }

  t.end();
});

test('serialize and deserialize buffer', (t) => {
  const buffer = Buffer.from([0x03, 0x04]);

  const serialized = serializeBuffer(buffer);
  t.equal(serialized, '0x0304');

  const deserialized = deserializeBuffer(serialized);
  t.ok(deserialized.equals(buffer));

  t.end();
});

test('serialize and deserialize null buffer', (t) => {
  const buffer = null;

  const serialized = serializeBuffer(buffer);
  t.equal(serialized, null);

  const deserialized = deserializeBuffer(serialized);
  t.equal(deserialized, null);

  t.end();
});

test('serialize object', (t) => {
  const source = {
    a: 1,
    b: 'value',
    c: Buffer.from([0x00, 0x02]),
    d: null,
    e: BigInt(100000000000000000),
    nested: {
      a: 1,
      b: 'value',
      c: Buffer.from([0x00, 0x02]),
      d: null,
      e: BigInt(100000000000000000),
    },
    array: [{ a: 5 }],
    f: 0n,
  };

  const serialized = serializeObject(source);
  t.equal(serialized.a, 1);
  t.equal(serialized.b, 'value');
  t.equal(serialized.c, '0x0002');
  t.equal(serialized.d, null);
  t.equal(serialized.e, '100000000000000000n');
  t.equal(serialized.f, '0n');

  t.equal(serialized.nested.a, 1);
  t.equal(serialized.nested.b, 'value');
  t.equal(serialized.nested.c, '0x0002');
  t.equal(serialized.nested.d, null);
  t.equal(serialized.nested.e, '100000000000000000n');
  t.equal(serialized.array.length, 1);

  t.end();
});

test('get median value', (t) => {
  const evenLength = [2, 3, 5, 7];
  const oddLength = [2, 3, 5, 7, 9];

  t.equal(median(evenLength), 4);
  t.equal(median(oddLength), 5);

  t.end();
});

test('ok response has correct format', (t) => {
  const data = { a: 'value' };

  const response = okResponse(data, 'my message');

  t.equal(response.code, 'ok');
  t.equal(response.data.a, 'value');
  t.equal(response.message, 'my message');

  t.end();
});

test('ok response has format without data', (t) => {
  const response = okResponse(null, 'no data');

  t.equal(response.code, 'ok');
  t.equal(response.message, 'no data');

  t.ok(!Object.prototype.hasOwnProperty.call('response', 'data'));

  t.end();
});

test('error response has correct format without errors', (t) => {
  const response = errorResponse(ErrorCode.NotFound, 'error message');

  t.equal(response.code, ErrorCode.NotFound);
  t.equal(response.message, 'error message');

  t.ok(!Object.prototype.hasOwnProperty.call('response', 'errors'));

  t.end();
});

test('error response has correct format with errors', (t) => {
  const response = errorResponse(ErrorCode.NotFound, 'error message', ['error 1']);

  t.equal(response.code, ErrorCode.NotFound);
  t.equal(response.message, 'error message');

  t.equal(response.errors[0], 'error 1');

  t.end();
});

test('mock chain with blocks', async (t) => {
  const numOfBlocks = 12;

  const chain = await mock.chainWithBlocks(numOfBlocks, 3);

  t.equal(chain.getLength(), numOfBlocks);
  // t.equal(await chain.verify(), true);

  t.end();
});

test('mock a block with transactions', async (t) => {
  const numOfTransactions = 3;
  const block = await mock.blockWithTransactions(numOfTransactions);

  t.equal(block.getTransactionCount(), numOfTransactions);
  t.equal(await block.verify(null, Chain.blockRewardAtIndex(0)), true);
  t.end();
});
