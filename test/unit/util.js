const { test } = require('tap');

const { runningManualTest } = require('../../util/db');
const { serializeBuffer, deserializeBuffer } = require('../../util/serialize');

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
  const buffer = null;

  t.equal(serializeBuffer(null), null);
  t.equal(deserializeBuffer(null), null);

  t.end();
});
