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
module.exports = (duniterServer, host, port) => co(function *() {

  // Remuniter UI
  let httpServer = webserver(host, port, duniterServer);
  yield httpServer.openConnection();

  // Wallet usage
  let remuWallet = wallet(duniterServer);

  /**
   * PAY LOOP!
   */
  let lastCurrent = null;

  let pay = () => co(function *() {
    try {
      // Wallet handling
      let lastPaidNumber = yield remuWallet.getLastPaid(PAY_START_BLOCK);

      // Get the next chunk numbers
      let nextFrom = lastPaidNumber + 1;
      let nextTo = nextFrom + PAY_CHUNK_LENGTH - 1;

      // Get current block as a reference
      let current = yield duniterServer.dal.getCurrentBlockOrNull();

      // Time to pay
      if (nextTo < current.number) {

        let hasBeenPaid = yield remuWallet.arePaid(nextFrom, nextTo);
        let areBeingPaid = false;

        // If the chunk hasn't been paid
        if (!hasBeenPaid) {
          areBeingPaid = yield remuWallet.areBeingPaid(nextFrom, nextTo);

          // If the chunk is being paid
          if (areBeingPaid) {
            // Check if the payment will be done, or if we need to retry
            if (areBeingPaid.version == 3) {
              const number = parseInt(areBeingPaid.blockstamp.split('-')[0]);
              if (current.number - number > 10) {
                yield resetTransaction();
                areBeingPaid = false;
              }
            } else if (!lastCurrent || (current.number - lastCurrent.number > 10)) {
              yield resetTransaction();
              areBeingPaid = false;
            }
          }

          // If the chunk is NOT being paid yet
          if (!areBeingPaid) {
            // Try to pay
            areBeingPaid = yield remuWallet.pay(nextFrom, nextTo);
            // Is it OK?
            if (areBeingPaid) {
              console.log('Successfully sent payment for blocks #%s to #%s', nextFrom, nextTo);
              lastCurrent = current;
              setTimeout(pay, 1000);
            }
          }
        }
      }
    } catch (e) {
      console.error(e.stack || e);
    }
  });

  function resetTransaction() {
    return duniterServer.dal.txsDAL.exec('DELETE FROM txs WHERE NOT written AND issuers like \'%' + remuWallet.pubkey + '%\'');
  }


  setInterval(pay, PAY_PERIOD * 1000);
  pay();
})
  .catch((err) => console.error(err.stack || err));