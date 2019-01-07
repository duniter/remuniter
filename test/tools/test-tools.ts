import {Server} from 'duniter/server'
import {BlockProver} from 'duniter/app/modules/prover/lib/blockProver';
import {ProverDependency} from 'duniter/app/modules/prover';
import * as path from "path"
import * as os from "os"
import {BmaDependency} from 'duniter/app/modules/bma';
import {BlockDTO} from 'duniter/app/lib/dto/BlockDTO';

export class TestingServer {

  constructor(
    private port:number,
    private server:Server) {

    ProverDependency.duniter.methods.hookServer(server)

    server.addEndpointsDefinitions(async () => {
      return BmaDependency.duniter.methods.getMainEndpoint(server.conf)
    })
  }

  get _server(): Server {
    return this.server
  }

  async commit(options:any = null) {
    const proven = await this.generateNext(options)
    await this.server.writeBlock(proven, true, true) // The resolution is done manually
    const blocksResolved = await this.server.BlockchainService.blockResolution()
    console.log(BlockDTO.fromJSONObject(blocksResolved).getRawSigned())
    if (!blocksResolved) {
      throw Error('BLOCK_WASNT_COMMITTED')
    }
    return blocksResolved
  }

  async closeCluster() {
    const server:Server = this.server
    if ((server as any)._utProver) {
      const farm = await (server as any)._utProver.getWorker()
      await farm.shutDownEngine()
    }
  }

  private generateNext(options:any) {
    const server = this.server as any
    // Brings a priver to the server
    if (!server._utProver) {
      server._utProver = new BlockProver(server)
      server._utGenerator = ProverDependency.duniter.methods.blockGenerator(server, server._utProver)
    }
    return server._utGenerator.makeNextBlock(null, null, options)
  }
}

const MEMORY_MODE = true;
const CURRENCY_NAME = 'remuniter_test';
const HOST = '127.0.0.1';
let PORT = 10000;

export function NewTestingServer(conf:any) {
  const host = conf.host || HOST
  const port = conf.port || PORT++
  const commonConf = {
    nobma: false,
    bmaWithCrawler: true,
    port: port,
    ipv4: host,
    remoteipv4: host,
    currency: conf.currency || CURRENCY_NAME,
    httpLogs: true,
    forksize: conf.forksize || 3,
  };
  if (conf.sigQty === undefined) {
    conf.sigQty = 1;
  }
  // Disable UPnP during tests
  if (!conf.ws2p) {
    conf.ws2p = { upnp: false }
  }
  Object.keys(commonConf).forEach(k => conf[k] = (commonConf as any)[k])
  const server = new Server(
    path.resolve(path.join(os.homedir(), '/.config/duniter/' + (conf.homename || 'dev_unit_tests'))),
    conf.memory !== undefined ? conf.memory : MEMORY_MODE,
    conf);

  return new TestingServer(port, server)
}