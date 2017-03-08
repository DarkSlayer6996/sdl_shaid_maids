// Don't let stupid things happen, like destroying the production or staging database.
if(process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production") {
  console.log("Warning:  Attempting to run unit tests with NODE_ENV as development or production is a bad idea.  Changing the NODE_ENV to test.");
  process.env.NODE_ENV = "test";
} else if( ! process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

if(process.env.DB_PASSWORD === "INVALID-PASSWORD") {
  console.log("WARNING:  DB_PASSWORD environment variable was not set.");
}

// Check if already running?

let assert = require('assert'),
  config = require('./config'),
  crave = require("crave"),
  path = require("path");

let applicationPath = path.resolve("./app"),
  Cql = require(path.resolve('./libs/cql')),
  Log = require(path.resolve('./libs/log')),
  Server = require(path.resolve('./server.js'));

let server = {
  config: config,
  log: (new Log()).createLogger(config.log),
  maids: require(require('path').resolve('./server.js'))
};

crave.setConfig(config.crave);

describe('MAIDS', function () {

  // Load the test data object that will be passed into each test file.
  before(function (done) {
    this.timeout(0);

    server.maidsInstance = new Server();
    server.maidsInstance.start().on('ready', function (seneca) {
      assert(seneca);
      server.seneca = seneca;
      //server.app = require('supertest')(expressApp);
      server.cql = server.maidsInstance.cql;
      done();
    })
  });

  it('load all tests', function (done) {
    this.timeout(0);

    // Recursively load all the test files that are located in the apps folder.
    crave.directory(applicationPath, ["test"], done, server);
  });

});
