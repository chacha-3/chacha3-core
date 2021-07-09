const { test } = require('tap');

const { runningManualTest } = require('../../util/db');

test('detect running unit test', (t) => {
  const argv = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Users\\user21\\Projects\\bong\\test\\unit\\util.js',
  ];

  t.equal(runningManualTest(argv), true);
  t.end();
});
