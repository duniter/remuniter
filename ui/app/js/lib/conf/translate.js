module.exports = (app) => {

  app.config(['$translateProvider', ($translateProvider) => {

    let lang = 'en';

    $translateProvider.translations('en', require('./i18n/en'));
    $translateProvider.translations('fr', require('./i18n/fr'));

    if (navigator.language && navigator.language.match(/^(en|fr)$/)) {
      lang = navigator.language;
    }

    // Default language
    $translateProvider.preferredLanguage(lang);

    // Other parameters
    $translateProvider.useSanitizeValueStrategy('');
  }]);
};
