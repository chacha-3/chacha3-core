const normalizedPath = require('path').join(__dirname, '../actions');

require('fs').readdirSync(normalizedPath).forEach((file) => {
  if (file === 'index.js') {
    return;
  }

  const actions = require(`../actions/${file}`);

  const schemas = [];

  Object.keys(actions).forEach((key) => {
    schemas.push({ actionName: key, schema: actions[key].schema });
  });

  if (file === 'peer.js') {
    console.log(JSON.stringify(schemas, null, 2));
  }
});
