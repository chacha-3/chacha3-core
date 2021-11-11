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

test('mock peer response matches options', async (t) => {
  const options = { action: 'blockInfo', hash: '0x0050ea546768dc7609dc5fe4efe00d8d84349d02fcde3cfad6115360b7e6d9c1' };
  const response = sendTestRequest(HOST_127_0_0_100, PORT_7000, options);

  const { data } = JSON.parse(response);

  t.not(data, undefined);
  t.end();
});
