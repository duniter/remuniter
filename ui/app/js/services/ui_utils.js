module.exports = (app) => {

  app.factory('UIUtils', function($q, $translate, $state, $location) {
      return {

        toast: (msg) => {
          return $q.when($translate(msg)).then((translated) => Materialize.toast(translated, 4000))
        },

        enableInputs: () => $('i.prefix, label[value!=""]').addClass('active'),

        enableTabs: () => {
          let jTabs = $('ul.tabs');
          jTabs.tabs();
          $('ul.tabs a').click((e) => {
            let href = $(e.currentTarget).attr('href');
            let state = href.slice(1);
            $state.go(state);
          });

          let currentID = $location.path()
            .replace(/\//g, '.')
            .replace(/\./, '');

          jTabs.tabs('select_tab', currentID);
        },

        changeTitle: (version) => document.title = 'Duniter ' + version
      }
    });
};
