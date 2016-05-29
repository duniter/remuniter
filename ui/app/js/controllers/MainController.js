"use strict";

const co = require('co');

module.exports = ($scope, $http, $state, WS) => {

  $scope.remains_days = '';
  $scope.unit = 'units';
  $scope.blocks = [];
  $scope.top1 = [];
  $scope.top2 = [];

  let socket = WS.block((data) => {
    $scope.remun_key = data.key;
    $scope.remains = data.remains;
    $scope.remains_days = data.remains_days;
    $scope.pay_per_block = data.pay_per_block;
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
