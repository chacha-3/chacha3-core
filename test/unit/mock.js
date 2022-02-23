const { test } = require('tap');

const mock = require('../../util/mock');
const blockData = require('../../util/mock/data/blocks.json');
const { sendTestRequest, HOST_127_0_0_100, PORT_7000 } = require('../../util/peer-response');

test('mock chain with blocks', async (t) => {
  const chain = await mock.chainWithBlocks(5, 5);

  t.end();
});

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
  const { hash } = blockData[1].header;

  const options = { action: 'blockInfo', hash };
  const response = sendTestRequest(HOST_127_0_0_100, PORT_7000, options);

  const { data } = JSON.parse(response);
  t.equal(data.header.hash, hash);

  t.end();
});
