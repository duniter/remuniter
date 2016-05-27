"use strict";

const co = require('co');

module.exports = ($scope, $http, $state, WS) => {

  $scope.blocks = [];

  let socket = WS.block((blocks) => {
    console.log(blocks);
    for (let i = 0, len = blocks.length; i < len; i++) {
      $scope.blocks.push(blocks[i]);
    }
    try {
      $scope.$apply();
    } catch (e) {
      console.error(e);
    }
  });

  return co(function *() {
    yield socket.openPromise;
    socket.send('read blocks');
  });
};
