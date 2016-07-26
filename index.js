let path = require('path'),
  Server = require(require('path').resolve('./server.js'));

let server = new Server();
server.start();