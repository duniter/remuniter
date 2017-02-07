var co = require('co');
var conf = require('js/lib/conf/conf');

module.exports = (angular) => {

  angular.module('duniter.services', ['ngResource'])

    .factory('WS', function() {

      function WS(server) {

        let wsMap = {};

        function ws(uri, listener) {
          var sock = wsMap[uri] || new WebSocket(uri);
          wsMap[uri] = sock;
          sock.onclose = function(e) {
            console.log('close');
            console.log(e);
          };
          sock.onerror = function(e) {
            console.log('onerror');
            console.log(e);
          };
          let defered = Q.defer();
          let openPromise = defered.promise;
          sock.onopen = () => defered.resolve();
          sock.onmessage = function(e) {
            listener(JSON.parse(e.data));
          };
          return {
            openPromise: openPromise,
            send: (msg) => sock.send(msg)
          };
        }

        return {
          block: (f) => ws(wsProtocol() + server + '/ws/block', f)
        }
      }
      let server = conf.server || window.location.hostname;
      let port = conf.port || window.location.port;
      var service = WS([server, port].join(':'));
      service.instance = WS;
      return service;
    });
};

function wsProtocol() {
  return window.location.protocol.match(/^https/) ? 'wss://' : 'ws://';
}
