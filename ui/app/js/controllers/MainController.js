"use strict";

module.exports = ($scope, $http, $state, WS) => {

  $scope.blocks = [];

  let initialCall = true;

  WS.block((blocks) => {
    console.log(blocks);
    for (let i = 0, len = blocks.length; i < len; i++) {
      $scope.blocks.push(blocks[i]);
    }
    if (!initialCall) {
      $scope.$apply();
    }
    initialCall = false;
  });
};
