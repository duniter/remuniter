var _ = require('underscore');
var conf = require('../lib/conf/conf');

module.exports = (app) => {

    app.filter('mt_date', ($filter) => {
      return (input) => {
        if(input == null){ return ""; }
        var _date = $filter('date')(new Date(input * 1000), 'yyyy-MM-dd');
        return _date.toUpperCase();
      };
    });

    app.filter('mt_time', ($filter) => {
      return (input) => {
        if(input == null){ return ""; }
        var _date = $filter('date')(new Date(input * 1000), 'HH:MM:ss');
        return _date.toUpperCase();
      };
    });
};
