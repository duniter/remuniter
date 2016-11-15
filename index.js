#!/usr/bin/env node
"use strict";

const co = require('co');
const duniter = require('duniter');
const main = require('./lib/main.js');

/****************************************
 * TECHNICAL CONFIGURATION
 ***************************************/

const HOME_DUNITER_DATA_FOLDER = 'remuniter';
const SERVER_HOST = "localhost";
const SERVER_PORT = 8555;

/****************************************
 * STARTING DUNITER NODE
 ***************************************/

// Use netobs data folder
if (!process.argv.includes('--mdb')) {
  process.argv.push('--mdb');
  process.argv.push(HOME_DUNITER_DATA_FOLDER);
}

// Default action = start
if (process.argv.length === 4) process.argv.push('start');

// Disable Duniter logs
duniter.statics.logger.mute();

duniter.statics.cli((duniterServer) => co(function*() {

  try {

    /****************************************
     * SPECIALIZATION
     ***************************************/

    // Remuniter
    main(duniterServer, SERVER_HOST, SERVER_PORT);

  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}));
