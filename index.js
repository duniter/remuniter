#!/usr/bin/env node
"use strict";

const program = require('commander');
const co = require('co');
const rp = require('request-promise');
const duniter = require('duniter');
const spawn = require('child_process').spawn;
const path = require('path');
const pjson = require('./package.json');

/**
 * Configuration variables
 */
const HOME_DUNITER_DATA_FOLDER = 'remuniter';
const DUNITER_HTTP_LOGS = true;

let server = duniter({ name: HOME_DUNITER_DATA_FOLDER }); // Node configuration is inside the home folder

process.on('uncaughtException', function (err) {
  console.error(err);
  process.exit(1);
});

program
  .version(pjson.version)
  .usage('<command> [options]');

program
  .command('start')
  .description('Start the server.')
  .action(() => co(function *() {
    // Conf
    yield server.plugFileSystem();
    yield server.loadConf();

    // Services
    yield server.initDAL();

    let current = yield server.BlockchainService.current();

    if (!current) {
      throw 'Your node has not been initialized with a currency. Please run `sync <server> <port>` command before running this program.';
    }
    yield server.checkConfig();
    yield server.listenToTheWeb(DUNITER_HTTP_LOGS);

    // Routing documents
    server.routing();

    if (server.conf.upnp) {
      yield server.upnp();
    }

    yield server.start();
  })
    .catch((err) => console.error(err.stack || err)));

let duniter_subcommand = ['config', 'sync', 'reset', 'wizard'].indexOf(process.argv[2]) !== -1;
if (duniter_subcommand) {
  let duniterbin = path.resolve(path.dirname(process.argv[1]), './node_modules/duniter/bin/ucoind');
  let duniter_spawn = spawn(process.argv[0], [duniterbin].concat(process.argv.slice(2)).concat(['--mdb', HOME_DUNITER_DATA_FOLDER]));

  process.stdin.pipe(duniter_spawn.stdin);
  duniter_spawn.stdout.pipe(process.stdout);
  duniter_spawn.stderr.pipe(process.stderr);

  duniter_spawn.on('close', () => {
    process.exit(0);
  });
} else {
  program.parse(process.argv);

  if (program.args.length == 0) {
    console.error('No command given');
    process.exit(2);
  }
}
