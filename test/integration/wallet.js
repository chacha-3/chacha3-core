const { test } = require('tap');

const app = require('../../app')();

test('list all wallet', async (t) => {
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: {
      action: 'listWallets',
    },
  });

  // console.log(response.body);
  // t.equal(response.statusCode, 200, 'returns a status code of 200');
  t.end();
});
