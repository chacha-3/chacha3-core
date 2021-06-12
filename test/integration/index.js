const { test } = require('tap');

const build = require('../../app');

test('reach endpoint index', async (t) => {
  const app = build();

  const response = await app.inject({
    method: 'POST',
    url: '/',
  });

  t.equal(response.statusCode, 200, 'returns a status code of 200');

  t.end();
});
