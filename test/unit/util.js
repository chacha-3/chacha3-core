const { test } = require('tap');

const { runningManualTest } = require('../../util/db');
const { serializeBuffer, deserializeBuffer } = require('../../util/serialize');
const { okResponse, errorResponse, ErrorCode } = require('../../util/rpc');

test('detect running unit test', (t) => {
  const argvTest = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\user21\\Projects\\bong\\test\\unit\\util.js',
  ];

  const argvNonTest = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\user21\\Projects\\bong\\shell.js',
  ];

  t.equal(runningManualTest(argvTest), true);
  t.equal(runningManualTest(argvNonTest), false);
  t.equal(runningManualTest([]), false);

  t.end();
});

test('serialize and deserialize buffer', (t) => {
  const buffer = Buffer.from([0x00, 0x01, 0x02]);

  t.equal(serializeBuffer(buffer), '000102');
  t.ok(deserializeBuffer('000102').equals(buffer));

  t.end();
});

test('serialize and deserialize null buffer', (t) => {
  t.equal(serializeBuffer(null), null);
  t.equal(deserializeBuffer(null), null);

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
