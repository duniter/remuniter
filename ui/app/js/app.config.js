module.exports = () => {

  require('./services/ws')(angular);

  var duniterApp = angular.module('duniterUIApp', [
    'ui.router',
    'homeControllers',
    'pascalprecht.translate'
  ]);

  require('./lib/conf/translate')(duniterApp);
  require('./lib/conf/routes')(duniterApp);
  require('js/services/datetime')(duniterApp);
  require('js/services/ui_utils')(duniterApp);
  require('js/services/graphs')(duniterApp);

  let homeControllers = angular.module('homeControllers', ['duniter.services']);

  homeControllers.controller('IndexController', require('./controllers/IndexController'));
  homeControllers.controller('MainController', require('./controllers/MainController'));
};
