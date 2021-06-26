const readline = require('readline');

const actions = require('./actions');

const rl = readline.createInterface(process.stdin, process.stdout);

rl.setPrompt('> ');
rl.prompt();

rl.on('line', async (line) => {
  const inputParsed = JSON.parse(line);

  const actionName = inputParsed.action;
  const action = actions[actionName];

  if (!action) {
    console.log(`Action ${actionName} not found`);
  }

  const { handler } = action;

  const { data, code } = await handler(inputParsed);
  // console.log(`Code: ${code}`);
  console.log(JSON.stringify({ data }, null, 2));

  rl.prompt();
}).on('close', () => {
  console.log('Have a great day!');
  process.exit(0);
});
