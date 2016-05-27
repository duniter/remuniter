"use strict";

const rp = require('request-promise');
const co = require('co');
const webserver = require('./webserver.js');
const duniter = require('./duniter.js');

/****************************
 * Main algorithm
 */
module.exports = (host, port, homeFolderName, httpLogs) => co(function *() {
  let duniterServer = yield duniter(homeFolderName, httpLogs);
  let httpServer = webserver(host, port, duniterServer);
  yield httpServer.openConnection();
})
  .catch((err) => console.error(err.stack || err));