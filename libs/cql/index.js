let async = require('async'),
  cassandra = require('cassandra-driver'),
  path = require('path');

class Cqlsh {
  constructor(server) {
    this.server = server;
    this.config = server.config;
    this.log = server.log;
  }

  init(cb) {
    let self = this,
      tasks = [];

    let cassandraConfig = JSON.parse(JSON.stringify(self.config.get('cassandra')));
    delete cassandraConfig.keyspace;

    self.db = new cassandra.Client(cassandraConfig);

    tasks.push(function (next) {
      self.connect(next);
    });

    if(self.config.has('cassandra.dropKeyspaceOnInit') && self.config.get('cassandra.dropKeyspaceOnInit') === true) {
      tasks.push(function (next) {
        self.dropKeyspace(self.config.get('cassandra.keyspace'), next);
      });
    }

    tasks.push(function(next) {
      self.createKeyspace(self.config.get('cassandra.keyspace'), self.config.get('cassandra'), next);
    });


    async.series(tasks, function (err, results) {
      cb(err, self.db);
    });

  }

  connect(cb) {
    let self = this;

    self.db.connect(function(err) {
      if(err) {
        self.db.shutdown();
        cb(err);
      } else {
        self.log.trace("Connected to Cassandra cluster with %d host%s.", self.db.hosts.length, (self.db.hosts.length > 1) ? "s": "");
        let hostCount = 1;
        self.db.hosts.forEach(function(host) {
          self.log.trace('\tHost (%d/%d) - %s v%s on rack "%s" in datacenter "%s".', hostCount++, self.db.hosts.length, host.address, host.cassandraVersion, host.rack, host.datacenter);
        });
        cb();
      }
    });
  }

  createKeyspace(keyspace, options, cb) {
    let self = this;

    let cql = "CREATE KEYSPACE IF NOT EXISTS " + keyspace +
      " WITH REPLICATION = " + JSON.stringify(options.replication);

    if(self.config.has('cassandra.durableWrite')) {
      cql += " AND DURABLE_WRITE = " + options.durableWrite;
    }
    cql += ";";
    cql = cql.replace(/"/g, "'");

    self.log.trace('cql.createKeyspace(): Executing query to create keyspace "%s".  "%s"', keyspace, cql);
    self.db.execute(cql, function (err, resultSet) {
      if(err) {
        cb(err, resultSet);
      } else if( ! self.db.metadata.keyspaces[keyspace]) {
        cb(new Error("cql.createKeyspace():  Keyspace '"+keyspace+"' has failed to be created."), resultSet);
      } else {
        self.log.trace('cql.createKeyspace():  Keyspace "%s" has been created or already exists.', keyspace);
        cb(undefined, resultSet);
      }
    });
  }
  
  dropKeyspace(keyspace, cb) {
    let self = this;

    if(self.db.metadata.keyspaces[keyspace]) {
      let cql = "DROP KEYSPACE IF EXISTS " + keyspace + ";";
      self.log.trace('cql.dropKeyspace(): Executing query to drop keyspace "%s". "%s"', keyspace, cql);
      self.db.execute(cql, function (err, resultSet) {
        if(err) {
          cb(err, resultSet);
        } else if(self.db.metadata.keyspaces[keyspace]) {
          cb(new Error("cql.dropKeyspace():  Keyspace '"+keyspace+"' was not removed."), resultSet);
        } else {
          self.log.trace('cql.dropKeyspace():  Keyspace "%s" has been removed.', keyspace);
          cb(undefined, resultSet);
        }
      });
    } else {
      self.log.trace('cql.dropKeyspace():  Keyspace "%s" was already removed.', keyspace);
      cb();
    }
  }

  createTable(tableName, columns, cb, keyspace) {
    let self = this;
    keyspace = (keyspace) || self.config.get('cassandra.keyspace');

    let columnsCql = "(" + columns.join(',') + ")";

    let cql = "CREATE TABLE IF NOT EXISTS "+keyspace+"."+tableName+" "+columnsCql+";";
    self.db.execute(cql, function(err, resultSet) {
      if(err) {
        cb(err);
      } else {
        self.db.metadata.getTable(keyspace, tableName, function(err, table) {
          if(err) {
            self.log.trace('cql.createTable():  Table "%s" could not be created in "%s".', tableName, keyspace);
            cb(err);
          } else {
            self.log.trace('cql.createTable():  Table "%s" was created or already exists in keyspace "%s".', tableName, keyspace);
            cb(undefined, resultSet);
          }
        });
      }
    });
  }

  dropTable(tableName, cb, keyspace) {
    let self = this;
    keyspace = (keyspace) || self.config.get('cassandra.keyspace');

    let cql = "DROP TABLE "+keyspace+"."+tableName+";";
    self.db.execute(cql, function(err, resultSet) {
      if(err) {
        cb(err);
      } else {
        self.db.metadata.getTable(keyspace, tableName, function(err, table) {
          if(err) {
            self.log.trace('cql.dropTable():  Table "%s" could not be dropped in "%s".', tableName, keyspace);
            cb(err);
          } else {
            self.log.trace('cql.dropTable():  Table "%s" was dropped in keyspace "%s".', tableName, keyspace);
            cb(undefined, resultSet);
          }
        });
      }
    });
  }

  truncateTable(tableName, cb, keyspace) {
    let self = this;
    keyspace = (keyspace) || self.config.get('cassandra.keyspace');

    let cql = "TRUNCATE "+keyspace+"."+tableName+";";
    self.db.execute(cql, function(err, resultSet) {
      if(err) {
        cb(err);
      } else {
        self.log.trace('cql.truncateTable():  Table "%s.%s" was truncated.', keyspace, tableName);
        cb(undefined, resultSet);
      }
    });
  }

  loadModels(cb) {
    let self = this,
      crave = require('crave'),
      models = {};

    crave.setConfig(self.config.get('crave'));

    let craveCb = function(err, filesRequired, modelObjects) {
      if(err) {
        cb(err);
      } else {
        let tasks = [];
        for(let i = 0; i < modelObjects.length; i++) {
          if(modelObjects[i]) {
            tasks.push(function(next) {
              modelObjects[i].createTable(next);
            });
            models[modelObjects[i].getTableName()] = modelObjects[i];
          }
        }

        async.series(tasks, function(err, results) {
          if(err) {
            cb(err);
          } else {
            self.models = models;
            cb(undefined, models);
          }
        });
      }
    };

    // At the time of initialization, the server does not have
    // the updated cassandraClient, so we need to update it before
    // loading the modules.
    self.server.cassandraClient = self.db;

    // Recursively load all files of the specified type(s) that are also located in the specified folder.
    crave.directory(path.resolve("./app"), ["model"], craveCb, self.server);
  }

  dropModels(cb) {
    let self = this,
      crave = require('crave'),
      models = {};

    crave.setConfig(self.config.get('crave'));

    let craveCb = function(err, filesRequired, modelObjects) {
      if(err) {
        cb(err);
      } else {
        let tasks = [];
        for(let i = 0; i < modelObjects.length; i++) {
          if(modelObjects[i]) {
            tasks.push(function(next) {
              modelObjects[i].dropTable(next);
            });
            models[modelObjects[i].getTableName()] = modelObjects[i];
          }
        }

        async.series(tasks, function(err, results) {
          if(err) {
            cb(err);
          } else {
            self.models = undefined;
            cb(undefined, models);
          }
        });
      }
    };

    // At the time of initialization, the server does not have
    // the updated cassandraClient, so we need to update it before
    // loading the modules.
    self.server.cassandraClient = self.db;

    // Recursively load all files of the specified type(s) that are also located in the specified folder.
    crave.directory(path.resolve("./app"), ["model"], craveCb, self.server);
  }

  truncateModels(cb) {
    let self = this,
      crave = require('crave'),
      models = {};

    crave.setConfig(self.config.get('crave'));

    let craveCb = function(err, filesRequired, modelObjects) {
      if(err) {
        cb(err);
      } else {
        let tasks = [];
        for(let i = 0; i < modelObjects.length; i++) {
          if(modelObjects[i]) {
            tasks.push(function(next) {
              modelObjects[i].truncateTable(next);
            });
            models[modelObjects[i].getTableName()] = modelObjects[i];
          }
        }

        async.series(tasks, function(err, results) {
          if(err) {
            cb(err);
          } else {
            self.models = undefined;
            cb(undefined, models);
          }
        });
      }
    };

    // At the time of initialization, the server does not have
    // the updated cassandraClient, so we need to update it before
    // loading the modules.
    self.server.cassandraClient = self.db;

    // Recursively load all files of the specified type(s) that are also located in the specified folder.
    crave.directory(path.resolve("./app"), ["model"], craveCb, self.server);
  }
  
}

module.exports = Cqlsh;