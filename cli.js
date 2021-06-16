#!/usr/bin/env node
/* eslint-disable no-unused-expressions */
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// const server = require('./server');

yargs(hideBin(process.argv))
  .command('serve [port]', 'start the server', (yargs) => yargs
    .positional('port', {
      describe: 'port to bind on',
      default: 5000,
    }), (argv) => {
    if (argv.verbose) console.info(`start server on :${argv.port}`);
    // serve(argv.port);
    require('./server');
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .argv;
