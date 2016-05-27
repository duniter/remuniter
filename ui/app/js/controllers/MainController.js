"use strict";

module.exports = ($scope, $http, $state, WS) => {

  $scope.blocks = [];

  WS.block((blocks) => {
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
};
