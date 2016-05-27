var co = require('co');
var _ = require('underscore');

module.exports = (app) => {

  app.config(['$stateProvider', '$urlRouterProvider', ($stateProvider, $urlRouterProvider) => {

    // States
    $stateProvider.
    state('index', {
      url: '/',
      template: require('views/index'),
      controller: 'IndexController'
    }).

    state('main', {
      url: '/',
      template: require('views/main'),
      controller: 'MainController'
    }).
      
    state('error', {
      url: '/error\?err',
      template: require('views/error'),
      controller: ($scope, $stateParams) =>
        $scope.errorMsg = $stateParams.err || 'err.unknown'
    });

    // Default route
    $urlRouterProvider.otherwise('/');
  }]);

  app.run(($rootScope, $state) => {
    $rootScope.$on('$stateChangeError', (event, toState, toParams, fromState, fromParams, error) => {
      console.error(error);
    });
  });
};
