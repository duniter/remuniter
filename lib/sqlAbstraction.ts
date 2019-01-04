import {Server} from "duniter/server";
import {SqliteNodeIOManager} from "duniter/app/lib/dal/indexDAL/sqlite/SqliteNodeIOManager";
import {DBTx} from "duniter/app/lib/db/DBTx";

export function getTxsDAL(server: Server): SqliteNodeIOManager<DBTx> {
  return (server.dal.txsDAL as any).driver
}
