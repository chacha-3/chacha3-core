const { test } = require('tap');
const mockAction = require('../mock/peer-calls');

test('mock peer response is valid JSON format', async (t) => {
  // TODO: Change to nodeInfo
  const options = { action: 'listPeers' };
  const response = await mockAction('127.0.0.1', 7000, options);

  let valid = true;

  try {
    JSON.parse(response);
  } catch (e) {
    valid = false;
  }

  t.equal(valid, true);
  t.end();
});
