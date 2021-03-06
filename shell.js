require('dotenv').config();

/* eslint-disable no-console */
const level = require('level');
const readline = require('readline');
const chalk = require('chalk');
const ipc = require('node-ipc');

const { parse } = require('shell-quote');
const debug = require('debug')('shell');

const { version } = require('./package.json');
const { SuccessCode } = require('./util/rpc');
const { port } = require('./util/env').config;

const { isBigIntString, deserializeBigInt } = require('./util/serialize');

const ShellDB = level('.shelldb');

function completer(line) {
  const completions = '/exit /quit /clear'.split(' ');
  // const completions = actionList;
  const hits = completions.filter((c) => c.startsWith(line));
  // Show all completions if none found
  return [hits.length ? hits : completions, line];
}

let retrying;
let lastRequest;

// let isPrompting = false;
let promptFields = [];

let prompt = null;

const rl = readline.createInterface(process.stdin, process.stdout, completer);
const ipcId = `chacha3_${port}`;

ipc.config.id = ipcId;
ipc.config.retry = 1500;
ipc.config.silent = true;

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

function printObject(objectData, sub = 0) {
  Object.keys(objectData).forEach((key) => {
    const niceKeyName = camelCaseToTitle(key);

    let value = objectData[key];

    if (typeof (value) === 'boolean') {
      value = value ? 'Yes' : 'No';
    } else if (value === null) {
      value = 'None';
    } else if (Array.isArray(value)) {
      value = `[${value.length}]`;
    } else if (isBigIntString(value)) {
      value = deserializeBigInt(value).toLocaleString('EN-US');
    }

    if (typeof (value) === 'object') {
      console.log(`${chalk.bold.cyanBright(niceKeyName)}`);
      printObject(value, sub + 1);
      value = '';
    } else {
      const subPrefix = (sub > 0) ? '- ' : '';
      console.log(`${subPrefix}${chalk.bold.cyanBright(niceKeyName)}: ${value}`);
    }
  });
}

function printArray(dataArray) {
  const { length } = dataArray;

  if (length === 0) {
    console.log('None');
    return;
  }

  for (let i = 0; i < length; i += 1) {
    if (typeof (dataArray[i]) === 'object') {
      printObject(dataArray[i]);
      console.log('');
    } else {
      console.log(dataArray[i]);
    }
  }
}

function printResult(result) {
  const {
    data, code, message, errors,
  } = result;

  if (code !== SuccessCode) {
    console.log(chalk.bold.red(message));

    if (errors) {
      errors.forEach((error) => {
        console.log(`- ${chalk.bold.yellow(error)}`);
      });
    }

    return;
  }

  console.log(chalk.bold.green(message));
  if (Array.isArray(data)) {
    printArray(data);
  } else if (data) {
    printObject(data);
  }
}

function setDefaultPrompt() {
  rl.setPrompt(chalk.bold.magentaBright('$ '));
}

function promptPendingField() {
  if (promptFields.length === 0) {
    return;
  }

  rl.setPrompt(`${camelCaseToTitle(promptFields[0])}: `);
  rl.prompt();
}
function start() {
  console.clear();
  console.log(`${chalk.bold.blueBright('ChaCha3 shell')} ${chalk.bold.gray(`(${version})`)}`);

  rl.prompt();
}

const loadHistory = async () => {
  let history;

  try {
    history = await ShellDB.get('history', { valueEncoding: 'json' });
  } catch (e) {
    history = [];
  }

  rl.history = history;
};

const saveHistory = async () => {
  await ShellDB.put('history', rl.history, { valueEncoding: 'json' });
};

const deleteHistory = async () => {
  rl.history = [];
  await ShellDB.put('history', [], { valueEncoding: 'json' });
};

// TODO: Modularize
const onLineInput = async (line) => {
  // eslint-disable-next-line no-param-reassign
  line = line.trim();
  // let options = {};

  // While prompting for password fields
  if (promptFields.length > 0) {
    // After prompt password.
    // Merge password to last request to sent again
    // options = lastRequest;

    const field = promptFields.shift();
    lastRequest[field] = line;

    // isPrompting = false;

    // Remove password from history
    rl.history.shift();
    await saveHistory();

    if (promptFields.length > 0) {
      promptPendingField();
      return;
    }

    setDefaultPrompt();
    ipc.of[ipcId].emit(
      'message', // any event or message type your server listens for
      JSON.stringify(lastRequest),
    );
  } else {
    // Handle special commands
    if (line === '/exit' || line === '/quit') {
      rl.close();
    } else if (line === '/clear') {
      console.clear();
      start();
      return;
    } else if (line === '/clean') {
      await deleteHistory();
      console.clear();
      start();
      return;
    }

    const parseQuote = parse(line);
    const actionName = parseQuote[0];

    const options = {
      action: actionName,
    };

    for (let i = 1; i < parseQuote.length; i += 1) {
      // Ignore operators such as & and |
      if (!parseQuote[i].op) {
        const [key, value] = parseQuote[i].split(':');
        options[key] = value;
      }
    }

    lastRequest = options;
    await saveHistory();

    ipc.of[ipcId].emit(
      'message', // any event or message type your server listens for
      JSON.stringify(options),
    );
  }
};

const onClose = () => {
  console.log('\nDisconnect');
  rl.write();
  process.exit(0);
};

const ipcConnect = async () => {
  retrying = false;
  await loadHistory();
  start();
};

const ipcDisconnect = () => {
  // rl.pause();
  // Check retrying to avoid repetitive disconnect message
  if (!retrying) {
    console.log('\nDisconnect. Retrying...');
  }

  retrying = true;
};

const ipcError = (error) => {
  debug(`Error connecting to IPC: ${error}`);

  if (!retrying) {
    console.log('Could not connect to server, ensure that it is running...');
  }

  retrying = true;
};

const ipcMessage = (data) => {
  const parsed = JSON.parse(data);
  prompt = parsed.prompt;

  if (prompt) {
    // const prompts = prompt.split('|');
    promptFields = prompt.split('|');
    promptPendingField();

    return;
  }

  printResult(parsed);
  rl.prompt();
};

setDefaultPrompt();

rl.input.on('keypress', () => {
  if (promptFields.length === 0) {
    return;
  }

  // Mask characters for password
  const len = rl.line.length;
  readline.moveCursor(rl.output, -len, 0);
  readline.clearLine(rl.output, 1);

  for (let i = 0; i < len; i += 1) {
    rl.output.write('*');
  }
});

rl.on('line', onLineInput);
rl.on('close', onClose);

ipc.connectTo(ipcId, () => {
  ipc.of[ipcId].on('connect', ipcConnect);
  ipc.of[ipcId].on('disconnect', ipcDisconnect);
  ipc.of[ipcId].on('error', ipcError);
  ipc.of[ipcId].on('message', ipcMessage);
});
