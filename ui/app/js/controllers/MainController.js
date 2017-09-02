"use strict";

const co = require('co');

module.exports = ($scope, $http, $state, WS, blocksTranslation) => {

  $scope.remains_days = '';
  $scope.unit = 'units';
  $scope.blocks = [];
  $scope.top1 = [];
  $scope.top2 = [];
  $scope.unitbase = 0;

  let socket = WS.block((data) => {
    $scope.current_window = '(' + data.issuersCount + ' ' + issuersTranslation + ', ' + data.issuersFrame + ' ' + blocksTranslation + ')';
    $scope.remun_key = data.key;
    $scope.remains = String(parseInt(data.remains / 100).toFixed(2)).replace('.', ',');
    $scope.remains_days = data.remains_days;
    $scope.pay_per_block = String(data.pay_per_block / Math.pow(10, data.unitbase) / 100).replace('.', ',');
    $scope.unit = data.unit;
    $scope.blocks = data.blocks;
    $scope.top1 = data.top1;
    $scope.top2 = data.top2;
    $scope.topgifts = data.topgifts;
    $scope.digits = data.topgifts.reduce((max, gift) => Math.max(max, String(gift.amount).length), 3) + 1;
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
