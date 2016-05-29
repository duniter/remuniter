"use strict";

const co = require('co');
const webserver = require('./webserver.js');
const duniter = require('./duniter.js');
const wallet = require('./wallet.js');

const PAY_START_BLOCK = 8068; // We pay for all blocks from this one
const PAY_CHUNK_LENGTH = 12 * 14; // We pay every X blocks
const PAY_PERIOD = 3 * 60; // The frequency by which the software tries to send money, in seconds

/****************************
 * Main algorithm
 */
module.exports = (host, port, homeFolderName, httpLogs) => co(function *() {

  // Duniter node
  let duniterServer = yield duniter(homeFolderName, httpLogs);

  // Remuniter UI
  let httpServer = webserver(host, port, duniterServer);
  yield httpServer.openConnection();

  // Wallet usage
  let remuWallet = wallet(duniterServer);

  /**
   * PAY LOOP!
   */

  let pay = () => co(function *() {
    try {
      // Wallet handling
      let lastPaidNumber = yield remuWallet.getLastPaid(PAY_START_BLOCK);

      let nextFrom = lastPaidNumber + 1;
      let nextTo = nextFrom + PAY_CHUNK_LENGTH - 1;

      let current = yield duniterServer.dal.getCurrentBlockOrNull();

      if (nextTo < current.number) {

        // let current = yield duniterServer.dal.getCurrentBlockOrNull();
        let hasBeenPaid = yield remuWallet.arePaid(nextFrom, nextTo);
        let areBeingPaid = false;
        if (!hasBeenPaid) {
          areBeingPaid = yield remuWallet.areBeingPaid(nextFrom, nextTo);
          if (!areBeingPaid) {
            areBeingPaid = yield remuWallet.pay(nextFrom, nextTo);
            if (areBeingPaid) {
              console.log('Successfully sent payment for blocks #%s to #%s', nextFrom, nextTo);
            }
          }
        }
      }
    } catch (e) {
      console.error(e.stack || e);
    }
  });

  setInterval(pay, PAY_PERIOD * 1000);
  pay();
})
  .catch((err) => console.error(err.stack || err));