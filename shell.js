const readline = require('readline');
const { parse } = require('shell-quote');

const actions = require('./actions');

const rl = readline.createInterface(process.stdin, process.stdout);

rl.setPrompt('> ');
rl.prompt();

rl.on('line', async (line) => {
  const parseQuote = parse(line);
  const actionName = parseQuote[0];

  const options = {};

  for (let i = 1; i < parseQuote.length; i += 1) {
    const [key, value] = parseQuote[i].split(':');
    options[key] = value;
  }

  const action = actions[actionName];

  if (action) {
    const result = await actions[actionName].handler(options);
    console.log(result);
  } else {
    console.log(`Action ${action} not found`);
  }


  rl.prompt();
}).on('close', () => {
  console.log('Have a great day!');
  process.exit(0);
});
