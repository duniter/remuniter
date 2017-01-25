"use strict";

String.prototype.lpad = function(padString, length) {
  let str = this;
  while (str.length < length)
    str = padString + str;
  return str;
};

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
