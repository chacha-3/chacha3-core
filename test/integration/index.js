// const { test } = require('tap');

// const build = require('../../app');

// test('cannot use unavailable action', async (t) => {
//   const app = build();

//   const response = await app.inject({
//     method: 'POST',
//     url: '/',
//     payload: {
//       action: 'iAmFree',
//     },
//   });

//   t.equal(response.statusCode, 400, 'returns a status code of 400');
//   t.end();
// });
