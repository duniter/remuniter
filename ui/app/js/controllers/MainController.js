"use strict";

const co = require('co');

module.exports = ($scope, $http, $state, WS) => {

  $scope.unit = 'units';
  $scope.blocks = [];
  $scope.top1 = [];
  $scope.top2 = [];

  let socket = WS.block((data) => {
    $scope.unit = data.unit;
    $scope.blocks = data.blocks;
    $scope.top1 = data.top1;
    $scope.top2 = data.top2;
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
