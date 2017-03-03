module.exports = function(server) {

  let async = require('async'),
    cassandra = require('cassandra-driver'),
    config = server.config,
    cql = server.cql,
    db = server.cassandraClient,
    log = server.log,
    remie = server.remie,
    uuid = require('uuid'),
    _ = require('lodash');


  /* ************************************************** *
   * ******************** Static Variables
   * ************************************************** */

  const QUERY_INSERT_APP_ID = 'INSERT INTO '+config.cassandra.keyspace+'.appids (id, createdBy, createdOn, isGenerated ) VALUES (?,?,?,?) IF NOT EXISTS';
  const QUERY_OPTIONS_PREPARED = { prepare: true };
  const QUERY_OPTIONS_BATCH_PREPARED_QUORUM = { prepare: true, consistency: cassandra.types.consistencies.quorum };
  const QUERY_EXISTS_APP_ID = 'SELECT id FROM '+config.cassandra.keyspace+'.appids WHERE id = ?';


  /* ************************************************** *
   * ******************** Global Static Methods
   * ************************************************** */

  let doesAppIdExist = function(id, cb) {
    db.execute(QUERY_EXISTS_APP_ID, [ id ], QUERY_OPTIONS_BATCH_PREPARED_QUORUM, function(err, result) {
      if (err) {
        cb(err)
      } else {
        next(undefined, (result && result.first() != null));
      }
    });
  };

  let insertAppIds = function (appIds, cb, retries) {
    if( ! appIds) {
      cb(remie.createInternal("insertAppIds(): AppIds is undefined, taking no action."));
    } else {
      if (_.isArray(appIds)) {
        if (appIds.length == 0) {
          cb();
        }
      } else {
        appIds = [appIds];
      }

      let errors = [],
        results = [];

      let queue = async.queue(function(appId, next) {
        insertAppId(appId, next, retries);
      }, 1);

      queue.push(appIds, function (err, result) {
        if(err) {
          errors.push(err);
        } else {
          results.push(result);
        }
      });

      queue.drain = function() {
        cb( (errors && errors.length != 0) ? errors : undefined, results);
      };
    }
  };

  let insertAppId = function(appId, cb, retries = config.appIds.maxGenRetry) {
    if( ! appId) {
      cb(remie.createInternal("insertAppId(): AppId is undefined, taking no action."));
    } else {
      log.trace("insertAppId():  Query to insert App ID.\n%s", JSON.stringify({ query: QUERY_INSERT_APP_ID, params: appId.toParams() }, undefined, 2));
      db.execute(QUERY_INSERT_APP_ID, appId.toParams(), QUERY_OPTIONS_PREPARED, function (err, rs) {
        if (err) {
          cb(remie.create(err, { referenceData: appId.toObject() }));
        } else {
          log.trace("insertAppId():  Results from the query to insert App ID.\n%s", JSON.stringify(rs, undefined, 2));

          if (rs.rows[0]["[applied]"] === true) {
            appId.applied = true;
            cb(undefined, appId.toObject());
          } else {
            if (appId.get("isGenerated") && retries > 0) {
              log.trace("insertAppId():  Failed to insert generated App ID \"%s\", regenerating and trying again.  Retry counter at %s.", appId.get("id"), retries);
              appId.generateNewId();
              insertAppId(appId, cb, --retries);
            } else {
              cb(remie.create("server.400.duplicateAppId", {
                messageData: {
                  id: appId.get("id")
                },
                referenceData: appId.toObject()
              }));
            }
          }
        }
      });
    }
  };


  /* ************************************************** *
   * ******************** AppId Class
   * ************************************************** */

  class AppId {
    constructor(columns = {}) {
      this.columns = {};
      this.columns.createdBy = columns.createdBy || columns.createdby || null;
      this.columns.createdOn = columns.createdOn || columns.createdon || new Date();

      if(columns.isGenerated !== undefined) {
        this.columns.isGenerated = columns.isGenerated;
      } else if(columns.isgenerated !== undefined) {
        this.columns.isGenerated = columns.isgenerated;
      }

      if(columns.id) {
        this.columns.id = "" + columns.id;
        if(this.columns.isGenerated === undefined) {
          this.columns.isGenerated = false;
        }
      } else {
        this.columns.id = uuid.v4();
        if(this.columns.isGenerated === undefined) {
          this.columns.isGenerated = true;
        }
      }

      this.applied = (columns["[applied]"] == true) ? true : false;
    }

    exists(cb) {
      doesAppIdExist(this.columns.id, cb);
    }

    get(key) {
      return this.columns[key];
    }

    toParams() {
      return [
        this.columns.id,
        this.columns.createdBy,
        this.columns.createdOn,
        this.columns.isGenerated.toString()
      ];
    }

    generateNewId() {
      this.columns.id = uuid.v4();
    }

    toObject() {
      return this.columns;
    }
  }


  /* ************************************************** *
   * ******************** AppId Model Class
   * ************************************************** */

  class AppIdModel {
    constructor() {
      this.keyspace = config.cassandra.keyspace;
      this.tableName = "appids";
    }

    /**
     * Create one or more new AppId instances.
     * @param columns data shared by all the newly created AppIds.
     * @param numOfIds number of AppIds to create.
     * @returns {Array|Object} the new AppId instances.
     */
    create(columns = {}, numOfIds = 1) {
      let appIds = [];
      for(let i = 0; i < numOfIds; i++) {
        appIds.push(new AppId(columns));
      }
      return (appIds.length > 1) ? appIds : appIds[0];
    }

    createTable(cb) {
      let columns = [
        "id text",
        "createdBy text",
        "createdOn timestamp",
        "isGenerated boolean",
        "PRIMARY KEY (id)"
      ];

      cql.createTable(this.getTableName(), columns, cb);
    }

    dropTable(cb) {
      cql.dropTable(this.getTableName(), cb);
    }

    truncateTable(cb) {
      cql.truncateTable(this.getTableName(), cb);
    }

    getTableName() {
      return this.tableName;
    }

    insert(appIds, cb, retries) {
      insertAppIds(appIds, cb, retries);
    }

    save(items, cb) {
      let queries = [],
        self = this;

      if(items && ! _.isArray(items)) {
        items = [ items ];
      }

      if(items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].model instanceof AppIdModel) {
            items[i] = items[i].toObject();
          }
          queries.push({
            query: QUERY_INSERT_APP_ID,
            params: [items[i].id, items[i].createdBy, items[i].createdOn]
          });
        }


        log.trace("AppIdModel.save():  Sending batch of queries to save AppId(s).\n%s", JSON.stringify(queries, undefined, 2));
        db.batch(queries, QUERY_OPTIONS_BATCH_PREPARED_QUORUM, function (err, resultSet) {
          if (err) {
            cb(err);
          } else {
            log.trace("AppIdModel.save():  Results from the batch of queries to save AppId(s).\n%s", JSON.stringify(resultSet, undefined, 2));
            cb(undefined, (items.length > 1) ? items : items[0]);
          }
        });
      } else {
        cb();
      }
    }

    exists(ids, cb) {
      let tasks = [];

      if (ids && !_.isArray(ids)) {
        ids = [ids];
      }

      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i++) {
          if (ids[i].model instanceof AppIdModel) {
            ids[i] = ids[i].toObject().id;
          }
          tasks.push(function(next) {
            db.execute(QUERY_EXISTS_APP_ID, [ ids[i] ], QUERY_OPTIONS_BATCH_PREPARED_QUORUM, function(err, result) {
              if(err) {
                cb(err)
              } else {
                next(undefined, (result && result.first() != null));
              }
            });
          });
        }

        async.parallel(tasks, cb);
      }
    }
  }


  return new AppIdModel();
};
