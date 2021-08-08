const readline = require('readline');
const chalk = require('chalk');

const Ajv = require('ajv');
const ajv = new Ajv({ coerceTypes: true, logger: false });

const { parse } = require('shell-quote');

const actions = require('./actions');

// function completer(line) {
//   // console.log(line);
//   const completions = '.help .error .exit .quit .q'.split(' ');
//   const hits = completions.filter((c) => c.startsWith(line));
//   // Show all completions if none found
//   return [hits.length ? hits : completions, line];
// }

function completer(linePartial, callback) { callback(null, [['123'], linePartial]); }

const rl = readline.createInterface(process.stdin, process.stdout);

function camelCaseToTitle(camelCase) {
  if (!camelCase) {
    return '';
  }

  const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.substr(1);
  return pascalCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([0-9])/gi, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2');
}

function printObject(objectData) {
  Object.keys(objectData).forEach((key) => {
    const niceKeyName = camelCaseToTitle(key);
    console.log(`${chalk.bold.cyan(niceKeyName)}: ${objectData[key]}`);
  });
}

function printArray(dataArray) {
  dataArray.forEach((data) => {
    // console.log(data);
    printObject(data);
    console.log('');
  });
}

function printResult(result) {
  const { data, code, message, error } = result;

  if (error) {
    return console.log(chalk.bold.red(error));
  }
  console.log(chalk.bold.green(message));
  // console.log(result);
  if (Array.isArray(data)) {
    printArray(data);
  } else {
    printObject(data);
  }
}

rl.setPrompt('> ');
rl.prompt();

rl.on('line', async (line) => {
  const parseQuote = parse(line.trim());
  const actionName = parseQuote[0];

  const options = {};

  for (let i = 1; i < parseQuote.length; i += 1) {
    const [key, value] = parseQuote[i].split(':');
    options[key] = value;
  }

  const action = actions[actionName];

  if (action) {
    let validate;

    if (action.schema) {
      validate = ajv.compile(action.schema);
      validate(options);
    }

    if (validate && validate.errors) {
      validate.errors.forEach((error) => {
        console.log(chalk.bold.red(error.message));
      });
    } else {
      const result = await actions[actionName].handler(options);
      printResult(result);
    }
  } else {
    console.log(`Action ${actionName} not found`);
  }

  rl.prompt();
}).on('close', () => {
  console.log('Have a great day!');
  process.exit(0);
});
