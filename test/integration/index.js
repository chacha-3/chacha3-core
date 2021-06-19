const { test } = require('tap');

const build = require('../../app');

test('establish connection with handshake', async (t) => {
  const app = build();

  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'handshake',
      version: 1,
    },
  });

  t.equal(response.statusCode, 200, 'returns a status code of 200');

  const { data } = response.json();
  console.log(response.body);

  t.equal(data.accepted, true, 'accepts handshake');
  t.equal(data.version, 1, 'version matches');

  t.end();
});
