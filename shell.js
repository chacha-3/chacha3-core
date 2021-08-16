/* eslint-disable no-console */
const readline = require('readline');
const chalk = require('chalk');
const ipc = require('node-ipc');

const Ajv = require('ajv');

const ajv = new Ajv({ coerceTypes: true, logger: false });

const { parse } = require('shell-quote');

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

    let value = objectData[key];

    if (typeof (value) === 'boolean') {
      value = value ? 'Yes' : 'No';
    } else if (value === null) {
      value = 'None';
    }

    console.log(`${chalk.bold.cyanBright(niceKeyName)}: ${value}`);
  });
}

function printArray(dataArray) {
  const { length } = dataArray;

  if (length === 0) {
    console.log('None');
    return;
  }

  for (let i = 0; i < length; i += 1) {
    printObject(dataArray[i]);
    console.log('');
  }
}

function printResult(result) {
  const {
    data, code, message, errors,
  } = result;
  // console.log(data, errors);
  if (code !== 'ok') {
    console.log(chalk.bold.red(message));

    if (errors) {
      errors.forEach((error) => {
        console.log(`- ${chalk.bold.yellow(error)}`);
      });
    }

    return;
  }

  console.log(chalk.bold.green(message));
  // console.log(result);
  if (Array.isArray(data)) {
    printArray(data);
  } else {
    printObject(data);
  }
}

const rl = readline.createInterface(process.stdin, process.stdout);

function start() {
  console.clear();
  console.log(`${chalk.bold.blueBright('Bong shell')} ${chalk.bold.gray(`(${process.env.npm_package_version})`)}`);

  rl.prompt();
}

ipc.config.id = 'hello';
ipc.config.retry = 1500;
ipc.config.silent = true;

let retrying;

const onConnect = () => {
  retrying = false;

  rl.setPrompt(chalk.bold.redBright('$ '));

  start();

  rl.on('line', async (line) => {
    // eslint-disable-next-line no-param-reassign
    line = line.trim();

    if (line === 'exit' || line === 'quit') {
      process.exit(0);
    } else if (line === 'clear') {
      console.clear();
      start();
      return;
    }

    const parseQuote = parse(line.trim());
    const actionName = parseQuote[0];

    const options = {
      action: actionName,
    };

    for (let i = 1; i < parseQuote.length; i += 1) {
      const [key, value] = parseQuote[i].split(':');
      options[key] = value;
    }

    ipc.of.world.emit(
      'message', // any event or message type your server listens for
      JSON.stringify(options),
    );
  }).on('close', () => {
    console.log('\nDisconnect');
    process.exit(0);
  });
};

const onDisconnect = () => {
  // Check retrying to avoid repetitive disconnect message
  if (!retrying) {
    console.log('\nDisconnect');
  }

  retrying = true;
};

const onMessage = (data) => {
  // ipc.log('got a message from world : '.debug, data);
  printResult(JSON.parse(data));
  rl.prompt();
};

ipc.connectTo('world', () => {
  ipc.of.world.on('connect', onConnect);
  ipc.of.world.on('disconnect', onDisconnect);
  ipc.of.world.on('message', onMessage);
});
