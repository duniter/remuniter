"use strict";

var co = require('co');

module.exports = ($scope, $http, $state) => {

  $scope.message = 'index.message.loading';
  co(function *() {
    return $state.go('main');
  });
};
