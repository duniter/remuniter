"use strict";

const co = require('co');
const webserver = require('./webserver.js');
const duniter = require('./duniter.js');
const wallet = require('./wallet.js');

/****************************
 * Main algorithm
 */
module.exports = (duniterServer, host, port, payperiod, paychunk, paystart, payperblock) => co(function *() {

  // Remuniter UI
  let httpServer = webserver(host, port, duniterServer, payperblock);
  yield httpServer.openConnection();

  // Wallet usage
  let remuWallet = wallet(duniterServer, payperblock);

  /**
   * PAY LOOP!
   */
  let lastCurrent = null;

  let pay = () => co(function *() {
    try {
      // Wallet handling
      let lastPaidNumber = yield remuWallet.getLastPaid(paystart);
      console.log('Last paid # is %s', lastPaidNumber);

      // Get the next chunk numbers
      let nextFrom = lastPaidNumber + 1;
      let nextTo = nextFrom + paychunk - 1;

      // Get current block as a reference
      let current = yield duniterServer.dal.getCurrentBlockOrNull();

      // Time to pay
      if (current && nextTo < current.number) {

        console.log('Time to pay');
        let hasBeenPaid = yield remuWallet.arePaid(nextFrom, nextTo);
        let areBeingPaid = false;

        // If the chunk hasn't been paid
        if (!hasBeenPaid) {
          console.log("No pending pay detected");
          areBeingPaid = yield remuWallet.areBeingPaid(nextFrom, nextTo);

          // If the chunk is being paid
          if (areBeingPaid) {
            console.log('But is being paid currently, wait a bit.');
            // Check if the payment will be done, or if we need to retry
            if (areBeingPaid.version == 3) {
              const number = parseInt(areBeingPaid.blockstamp.split('-')[0]);
              console.log('Current is #%s, last emitted payment was on #%s', current.number, number);
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
            console.log("Nothing in the radar, let's pay!");
            // Try to pay
            areBeingPaid = yield remuWallet.pay(nextFrom, nextTo);
            // Is it OK?
            if (areBeingPaid) {
              console.log('Successfully sent payment for blocks #%s to #%s', nextFrom, nextTo);
              lastCurrent = current;
              setTimeout(pay, 1000);
            } else {
              console.log('Payment not detected, do we have enough money?');
            }
          }
        } else {
          console.log('Has been paid already.');
        }
      }
    } catch (e) {
      console.error(e.stack || e);
    }
  });

  function resetTransaction() {
    return duniterServer.dal.txsDAL.exec('DELETE FROM txs WHERE NOT written AND issuers like \'%' + remuWallet.pubkey + '%\'');
  }

  if (payperiod) {
    setInterval(pay, payperiod * 1000);
    pay();
  }
})
  .catch((err) => console.error(err.stack || err));