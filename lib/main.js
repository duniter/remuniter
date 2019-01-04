"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const wallet_1 = require("./wallet");
const webserver_1 = require("./webserver");
const sqlAbstraction_1 = require("./sqlAbstraction");
/****************************
 * Main algorithm
 */
async function main(duniterServer, host, port, payperiod, paychunk, paystart, payperblock) {
    // Remuniter UI
    let httpServer = webserver_1.webserver(host, port, duniterServer, payperblock);
    await httpServer.openConnection();
    // Wallet usage
    let remuWallet = wallet_1.wallet(duniterServer, payperblock);
    /**
     * PAY LOOP!
     */
    let lastCurrent = null;
    let pay = async () => {
        try {
            // Wallet handling
            let lastPaidNumber = await remuWallet.getLastPaid(paystart);
            console.log('Last paid # is %s', lastPaidNumber);
            // Get the next chunk numbers
            let nextFrom = lastPaidNumber + 1;
            let nextTo = nextFrom + paychunk - 1;
            // Get current block as a reference
            let current = await duniterServer.dal.getCurrentBlockOrNull();
            // Time to pay
            if (current && nextTo < current.number) {
                console.log('Time to pay');
                let hasBeenPaid = await remuWallet.arePaid(nextFrom, nextTo);
                let areBeingPaid = false;
                // If the chunk hasn't been paid
                if (!hasBeenPaid) {
                    console.log("No pending pay detected");
                    areBeingPaid = await remuWallet.areBeingPaid(nextFrom, nextTo);
                    // If the chunk is being paid
                    if (areBeingPaid) {
                        console.log('But is being paid currently, wait a bit.');
                        // Check if the payment will be done, or if we need to retry
                        if (areBeingPaid.version == 3) {
                            const number = parseInt(areBeingPaid.blockstamp.split('-')[0]);
                            console.log('Current is #%s, last emitted payment was on #%s', current.number, number);
                            if (current.number - number > 10) {
                                await resetTransaction();
                                areBeingPaid = false;
                            }
                        }
                        else if (!lastCurrent || (current.number - lastCurrent.number > 10)) {
                            await resetTransaction();
                            areBeingPaid = false;
                        }
                    }
                    // If the chunk is NOT being paid yet
                    if (!areBeingPaid) {
                        console.log("Nothing in the radar, let's pay!");
                        // Try to pay
                        areBeingPaid = await remuWallet.pay(nextFrom, nextTo);
                        // Is it OK?
                        if (areBeingPaid) {
                            console.log('Successfully sent payment for blocks #%s to #%s', nextFrom, nextTo);
                            lastCurrent = current;
                            setTimeout(pay, 1000);
                        }
                        else {
                            console.log('Payment not detected, do we have enough money?');
                        }
                    }
                }
                else {
                    console.log('Has been paid already.');
                }
            }
        }
        catch (e) {
            console.error(e.stack || e);
        }
    };
    function resetTransaction() {
        return sqlAbstraction_1.getTxsDAL(duniterServer).sqlExec('DELETE FROM txs WHERE NOT written AND issuers like \'%' + remuWallet.pubkey + '%\'');
    }
    if (payperiod) {
        setInterval(pay, payperiod * 1000);
        pay();
    }
}
exports.main = main;
//# sourceMappingURL=main.js.map