#!/usr/bin/env node
"use strict";

const program = require('commander');
const co = require('co');
const spawn = require('child_process').spawn;
const path = require('path');
const pjson = require('./package.json');
const main = require('./lib/main.js');

process.on('uncaughtException', function (err) {
  console.error(err);
  process.exit(1);
});

/****************************************
 * TECHNICAL CONFIGURATION
 ***************************************/

const HOME_DUNITER_DATA_FOLDER = 'remuniter';
const DUNITER_HTTP_LOGS = true;
const SERVER_HOST = "localhost";
const SERVER_PORT = 8555;

/****************************************
 * PROGRAM COMMANDS
 ***************************************/

program
  .version(pjson.version)
  .usage('<command> [options]');

program
  .command('start')
  .description('Start the server.')
  .action(() => main(SERVER_HOST, SERVER_PORT, HOME_DUNITER_DATA_FOLDER, DUNITER_HTTP_LOGS));


/****************************************
 * SWITCH BETWEEN COMMANDS
 ***************************************/

let duniter_subcommand = ['config', 'sync', 'reset', 'wizard'].indexOf(process.argv[2]) !== -1;
if (duniter_subcommand) {

  /**
   * Forward command to Duniter
   */
  let duniterbin = path.resolve(path.dirname(process.argv[1]), './node_modules/duniter/bin/ucoind');
  let duniter_spawn = spawn(process.argv[0], [duniterbin].concat(process.argv.slice(2)).concat(['--mdb', HOME_DUNITER_DATA_FOLDER]));

  process.stdin.pipe(duniter_spawn.stdin);
  duniter_spawn.stdout.pipe(process.stdout);
  duniter_spawn.stderr.pipe(process.stderr);

  duniter_spawn.on('close', () => {
    process.exit(0);
  });
} else {

  /**
   * Local program command
   */
  program.parse(process.argv);

  if (program.args.length == 0) {
    console.error('No command given');
    process.exit(2);
  }
}
