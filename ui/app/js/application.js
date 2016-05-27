"use strict";

module.exports = {

  init: () => {

    // Hack since Node v5
    try {
      window.jade = require('jade' + '/' + 'runtime');
    } catch (e) {
      console.error(e);
    }

    console.log('Configuring Angular app...');

    require('./app.config')();

    console.log('App initialized.');
  }
};
