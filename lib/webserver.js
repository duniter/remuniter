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

module.exports = (host, port, duniterServer) => {

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
  listenWebSocket(httpServer, duniterServer);
  
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

function listenWebSocket(httpServer, duniterServer) {

  let lastBlocks = [];
  let wssBlock = new WebSocketServer({
    server: httpServer,
    path: '/ws/block'
  });

  wssBlock.on('connection', function connection(ws) {
    co(function *() {
      if (lastBlocks.length == 0) {
        let current = yield duniterServer.dal.getCurrent();
        lastBlocks = yield duniterServer.dal.getBlockFrom(current.number - 10);
      }
      ws.send(JSON.stringify(lastBlocks));
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
        wssBlock.broadcast(JSON.stringify([data]));
      }
    }));
}
