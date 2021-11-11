const { test } = require('tap');

const { sendTestRequest, HOST_127_0_0_100, PORT_7000 } = require('../../util/peer-response');

test('mock peer response is valid JSON format', async (t) => {
  const options = { action: 'nodeInfo' };
  const response = sendTestRequest(HOST_127_0_0_100, PORT_7000, options);

  let valid = true;

  try {
    JSON.parse(response);
  } catch (e) {
    valid = false;
  }

  t.equal(valid, true);
  t.end();
});
