import {Server} from "duniter/server";
import {DBBlock} from "duniter/app/lib/db/DBBlock";
import {wallet} from "./wallet";

"use strict";

const Q = require('q');
const _ = require('underscore');
const co = require('co');
const http = require('http');
const path = require('path');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const es = require('event-stream');

let WebSocketServer = require('ws').Server;

const PAY_UNIT = 'Ğ1';

export function webserver(host: string, port: number, duniterServer: Server, payperblock: number) {

  var staticContentPath = path.join(__dirname, '../ui/public');

  var app = express();

  app.use(morgan('\x1b[90m:remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms\x1b[0m', {
    stream: {
      write: function(message: any){
        message && console.log(message.replace(/\n$/,''));
      }
    }
  }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static(staticContentPath));

  let httpServer = http.createServer(app);
  let sockets: any = {}, nextSocketId = 0;
  httpServer.on('connection', function(socket: any) {
    let socketId = nextSocketId++;
    sockets[socketId] = socket;
    //logger.debug('socket %s opened', socketId);

    socket.on('close', () => {
      //logger.debug('socket %s closed', socketId);
      delete sockets[socketId];
    });
  });
  httpServer.on('error', function(err: any) {
    httpServer.errorPropagates(err);
  });

  // Websocket stuff
  listenWebSocket(httpServer, duniterServer, payperblock);
  
  return {
    openConnection: () => co(function *() {
      try {
        yield Q.Promise((resolve: any, reject: any) => {
          // Weird the need of such a hack to catch an exception...
          httpServer.errorPropagates = function(err: any) {
            reject(err);
          };
          //httpServer.on('listening', resolve.bind(this, httpServer));
          httpServer.listen(port, host, (err: any) => {
            if (err) return reject(err);
            resolve(httpServer);
          });
        });
        console.log('Server listening on http://' + host + ':' + port);
      } catch (e) {
        console.warn('Could NOT listen to http://' + host + ':' + port);
        console.warn(e);
      }
    }),
    closeSockets: () => {
      _.keys(sockets).map((socketId: any) => {
        sockets[socketId].destroy();
      });
    }
  };
};

function listenWebSocket(httpServer: any, duniterServer: Server, payperblock: number) {


  let remuWallet = wallet(duniterServer, payperblock);
  let lastBlocks: DBBlock[] = [];
  let top1 = remuWallet.lastDayTheoretical();
  let top2 = remuWallet.lastWeekTheoretical();
  let topgifts = remuWallet.topGifts();
  let wssBlock = new WebSocketServer({
    server: httpServer,
    path: '/ws/block'
  });

  let getData = () => co(function *() {
    try {
      let current = yield remuWallet.getCurrentBlock();
      let data1 = yield top1;
      let data2 = yield top2;
      let data3 = yield topgifts;
      yield lastBlocks.map((b: any) => co(function *() {
        const idty = yield remuWallet.getUID(b.issuer)
        b.uid = (idty && idty.uid) || b.issuer.substr(0, 10)
        return b;
      }));
      (current as any).uid = (yield remuWallet.getUID(current.issuer)).uid;
      let remains = yield remuWallet.remains();
      return {
        key: remuWallet.pubkey,
        current,
        issuersCount: current.issuersCount,
        issuersWeek: data2.length,
        issuersFrame: current.issuersFrame,
        remains: remains,
        remains_days: (Math.floor(remains / (remuWallet.pay_per_block * Math.pow(10, current.unitbase))) * duniterServer.conf.avgGenTime / (3600 * 24)).toFixed(1),
        pay_per_block: remuWallet.pay_per_block,
        unitbase: current.unitbase,
        blocks: lastBlocks,
        top1: data1,
        top2: data2,
        topgifts: data3,
        unit: PAY_UNIT
      };
    } catch (e) {
      console.error(e);
    }
  });

  wssBlock.on('connection', function connection(ws: any) {
    co(function *() {
      if (lastBlocks.length < 10) {
        let current = yield duniterServer.dal.getCurrentBlockOrNull();
        lastBlocks = yield duniterServer.dal.getBlocksBetween(current.number - 10, current.number);
      }

      ws.on('message', function(message: any) {
        console.log('received: %s', message);
        co(function *() {
          let toSend = yield getData();
          ws.send(JSON.stringify(toSend));
        });
      });
    });
  });

  wssBlock.broadcast = (data: any) => wssBlock.clients.forEach((client: any) => client.send(data));

  // Forward blocks
  duniterServer.on('data', async (data: any) => {

    if (data.bcEvent === 'newHEAD') {
      try {
        // Broadcast block
        lastBlocks.shift();
        lastBlocks.push(data.block);
        top1 = remuWallet.lastDayTheoretical();
        top2 = remuWallet.lastWeekTheoretical();
        topgifts = remuWallet.topGifts();
        co(function* () {
          let toSend = yield getData()
          wssBlock.broadcast(JSON.stringify(toSend));
        });
      } catch (e) {
        console.error(e)
      }
    }
  })
}
