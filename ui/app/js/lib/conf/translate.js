module.exports = (app) => {

  app.config(['$translateProvider', ($translateProvider) => {

    $translateProvider.translations('en', require('./i18n/en'));

    // Default language
    $translateProvider.preferredLanguage('en');

    // Other parameters
    $translateProvider.useSanitizeValueStrategy('');
  }]);
};
