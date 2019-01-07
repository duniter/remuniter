import {Statics} from 'duniter'
import {Server} from 'duniter/server';
import {ConfDTO} from 'duniter/app/lib/dto/ConfDTO';
import {main} from './lib/main'
import {webserver} from './lib/webserver'

/****************************************
 * TECHNICAL CONFIGURATION
 ***************************************/

// Default Duniter node's database
const HOME_DUNITER_DATA_FOLDER = 'remuniter';

// Default host on which Remuniter UI is available
const DEFAULT_HOST = 'localhost';

// Default port on which Remuniter UI is available
const DEFAULT_PORT = 8555;

// We pay for all blocks from this one
const PAY_START_BLOCK = 0;

// We pay every X blocks
const PAY_CHUNK_LENGTH = 10;

// The frequency by which the software tries to send money, in seconds
const PAY_PERIOD = 3 * 60;

// The total to pay per block
const PAY_PER_BLOCK = 1;

/****************************************
 * SPECIALIZATION
 ***************************************/

const stack = Statics.autoStack([{
  name: 'remuniter',
  required: {

    duniter: {

      cliOptions: [
        { value: '--payperiod <seconds>',     desc: 'Number of seconds between each pay loop (default ' + PAY_PERIOD + ').',     parser: (v: any) => parseInt(v) },
        { value: '--paychunk <chunk_size>',   desc: 'Number of blocks paid in each loop (default ' + PAY_CHUNK_LENGTH + ').',    parser: (v: any) => parseInt(v) },
        { value: '--paystart <block_number>', desc: 'Block number from which we pay issuers (default ' + PAY_START_BLOCK + ').', parser: (v: any) => parseInt(v) },
        { value: '--payperblock <amount>',    desc: 'Amount paid per block issued (default ' + PAY_PER_BLOCK + ').',             parser: (v: any) => parseInt(v) },
        { value: '--nopay',                   desc: 'Disable Remuniter pay loop (equivalent to --payperiod 0).'}
      ],

      cli: [{
        name: 'remuniter [host] [port]',
        desc: 'Starts Remuniter node',

        // Disables Duniter node's logs
        logs: false,

        onDatabaseExecute: async (server: Server, conf: ConfDTO, program: any, params: any, startServices: any) => {

          /****************************************
           * WHEN DUNITER IS LOADED, EXECUTE REMUNITER
           ***************************************/

          // Remuniter UI parameters
          const SERVER_HOST: string = params[0] || DEFAULT_HOST;
          const SERVER_PORT: number = parseInt(params[1]) || DEFAULT_PORT;

          if (program.nopay) {
            program.payperiod = 0;
          }

          // Remuniter Pay parameters
          const payperiod = program.payperiod !== undefined ? program.payperiod : PAY_PERIOD;
          const paychunk = program.paychunk !== undefined ? program.paychunk : PAY_CHUNK_LENGTH;
          const paystart = program.paystart !== undefined ? program.paystart : PAY_START_BLOCK;
          const payperblock = program.payperblock !== undefined ? program.payperblock : PAY_PER_BLOCK;

          // IMPORTANT: release Duniter services from "sleep" mode
          await startServices();

          // Remuniter
          try {

            // Remuniter UI
            let httpServer = webserver(SERVER_HOST, SERVER_PORT, server, payperblock);
            await httpServer.openConnection();

            // Remuniter Pay loop
            await main(server, payperiod, paychunk, paystart, payperblock);
          } catch (err) {
            console.error(err.stack || err)
          }

          // Wait forever, Remuniter is a permanent program
          await new Promise(() => null);
        }
      }]
    }
  }
}]);

(async () => {
  if (!process.argv.includes('--mdb')) {
    // We use the default database
    process.argv.push('--mdb');
    process.argv.push(HOME_DUNITER_DATA_FOLDER);
  }
  // Execute our program
  await stack.executeStack(process.argv);
  // End
  process.exit();
})()
