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
const wallet = require('./wallet.js');

let WebSocketServer = require('ws').Server;

const PAY_UNIT = 'Ğ1';

module.exports = (host, port, duniterServer, payperblock) => {

  var staticContentPath = path.join(__dirname, '../ui/public');

  var app = express();

  app.use(morgan('\x1b[90m:remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms\x1b[0m', {
    stream: {
      write: function(message){
        message && console.log(message.replace(/\n$/,''));
      }
    }
  }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static(staticContentPath));

  let httpServer = http.createServer(app);
  let sockets = {}, nextSocketId = 0;
  httpServer.on('connection', function(socket) {
    let socketId = nextSocketId++;
    sockets[socketId] = socket;
    //logger.debug('socket %s opened', socketId);

    socket.on('close', () => {
      //logger.debug('socket %s closed', socketId);
      delete sockets[socketId];
    });
  });
  httpServer.on('error', function(err) {
    httpServer.errorPropagates(err);
  });

  // Websocket stuff
  listenWebSocket(httpServer, duniterServer, payperblock);
  
  return {
    openConnection: () => co(function *() {
      try {
        yield Q.Promise((resolve, reject) => {
          // Weird the need of such a hack to catch an exception...
          httpServer.errorPropagates = function(err) {
            reject(err);
          };
          //httpServer.on('listening', resolve.bind(this, httpServer));
          httpServer.listen(port, host, (err) => {
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
      _.keys(sockets).map((socketId) => {
        sockets[socketId].destroy();
      });
    }
  };
};

function listenWebSocket(httpServer, duniterServer, payperblock) {


  let remuWallet = wallet(duniterServer, payperblock);
  let lastBlocks = [];
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
      yield lastBlocks.map((b) => co(function *() {
        b.uid = (yield remuWallet.getUID(b.issuer)).uid;
        return b;
      }));
      let remains = yield remuWallet.remains();
      return {
        key: remuWallet.pubkey,
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

  wssBlock.on('connection', function connection(ws) {
    co(function *() {
      if (lastBlocks.length < 10) {
        let current = yield duniterServer.dal.getCurrentBlockOrNull();
        lastBlocks = yield duniterServer.dal.getBlocksBetween(current.number - 10, current.number);
      }

      ws.on('message', function(message) {
        console.log('received: %s', message);
        co(function *() {
          let toSend = yield getData();
          ws.send(JSON.stringify(toSend));
        });
      });
    });
  });

  wssBlock.broadcast = (data) => wssBlock.clients.forEach((client) => client.send(data));

  // Forward blocks
  duniterServer
    .pipe(es.mapSync(function(data) {
      // Broadcast block
      if (data.joiners) {
        lastBlocks.shift();
        lastBlocks.push(data);
        top1 = remuWallet.lastDayTheoretical();
        top2 = remuWallet.lastWeekTheoretical();
        topgifts = remuWallet.topGifts();
        co(function *() {
          let toSend = yield getData(data);
          wssBlock.broadcast(JSON.stringify(toSend));
        });
      }
    }));
}
