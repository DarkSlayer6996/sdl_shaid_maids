module.exports = function(server) {

  let AppIds = server.models['appids'],
    config = server.config,
    express = require('express'),
    log = server.log,
    RichError = server.RichError,
    riposte = server.riposte,
    seneca = server.seneca,
    _ = require('lodash');

  const CAN_SET_APP_IDS_IN_CREATE_APP_IDS = (config.has('test.canSetAppIdsInCreateAppIds') && config.get('test.canSetAppIdsInCreateAppIds') === true) ? true : false,
    CAN_SET_RETRIES_IN_CREATE_APP_IDS = (config.has('test.canSetRetriesInCreateAppIds') && config.get('test.canSetRetriesInCreateAppIds') === true) ? true : false,
    PATTERN_BASE = 'service:maids,model:appids,method:';
  
  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  seneca.add(PATTERN_BASE+'register', function (msg, cb) {
    let createdBy = msg.user.id,
      ids = msg.ids,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInRegister');

    if( ! ids || ! _.isArray(ids) || ids.length == 0) {
      cb((new RichError("server.400.missingRequiredParameter", { i18next: { parameter: "ids" }, referenceData: req.body || req.query })).toObject());
    } else if(ids.length > maxNumOfIds) {
      cb((new RichError('server.400.maxNumOfIdsInRegisterExceeded', { i18next: { maxNumOfIds: maxNumOfIds, numOfIds: ids.length }, referenceData: ids })).toObject);
    } else {
      let appIds = [];
      for(let i = 0; i < ids.length; i++) {
        appIds.push(AppIds.create({ id: ids[i], createdBy: createdBy }));
      }

      AppIds.insert(appIds, function (errors, results) {
        cb(errors, results);
      });
    }
  });

  seneca.add(PATTERN_BASE+'create', function (msg, cb) {
    let createdBy = msg.user.id,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInCreate'),
      numOfIds = msg.numOfIds || 1;


    if( ! _.isFinite(numOfIds)) {
      //cb((new RichError('server.400.invalidParameter', {i18next: { parameter: "numOfIds", type: "number" }})).toObject());
      //cb(new Error('server.400.invalidParameter'));
      respond(new Error('server.400.invalidParameter'), undefined, cb);
    } else if(numOfIds > maxNumOfIds) {
      cb((new RichError('server.400.maxNumOfIdsInCreatedExceeded', { i18next: { maxNumOfIds: maxNumOfIds, numOfIds: numOfIds }, referenceData: ids })).toObject());
    } else {
      let appIds = [],
        retries;

      if (CAN_SET_RETRIES_IN_CREATE_APP_IDS) {
        retries = req.body.retries;
      }

      if (CAN_SET_APP_IDS_IN_CREATE_APP_IDS && req.body.ids !== undefined) {
        for (let i = 0; i < numOfIds; i++) {
          let columns = {
            createdBy: createdBy,
            isGenerated: true
          };
          if (req.body.ids && i < req.body.ids.length) {
            columns.id = req.body.ids[i];
          }
          appIds.push(AppIds.create(columns));
        }
      } else {
        appIds = AppIds.create({createdBy: createdBy}, numOfIds);
      }

      AppIds.insert(appIds, function (errors, results) {
        let reply = riposte.createReply();
        reply.addErrorsAndSetData(errors, results, function (err) {
          if(err) {
            cb(err);
          } else {
            reply.toObject(undefined, function(err, replyObject, replyStatusCode) {
              log.trace(replyObject)
              cb(err, replyObject);
            });
          }
        });
      }, retries);
    }
  });

  seneca.wrap('service:maids,model:appids', function (msg, cb) {
    let self = this,
    //let access_token = req.headers['authorization'] || req.query.access_token;
    access_token = msg.access_token;

    if( ! access_token) {
      console.log("Unauthorized");
      cb(undefined, (new RichError('server.400.unauthorized')).toObject());
    } else {
      console.log(msg.access_token);
      delete msg.access_token;
      this.prior(msg, cb);
    }
  });

  /* ************************************************** *
   * ******************** Route Methods
   * ************************************************** */

  function validateAccessToken(req, res, next) {
    let access_token = req.headers['authorization'] || req.query.access_token;

    if( ! access_token) {
      res.setUnauthorized(next);
    } else {
      req.user = {
        id: "1"
      };
      next();
    }
  }


  function respond(err, reply, cb) {
    let tasks = [];
    
    if( ! reply) {
      reply = riposte.createReply();
    }
    
    if(err) {
      tasks.push((next) => {
        reply.addErrors(err, function (err) {
          if(err) {
            next(err);
          } else {
            next(undefined, reply);
          }
        });
      });
    }
    
    tasks.push((next) => {
      reply.toObject(undefined, next);
    });

    async.waterfall(tasks, cb);
  }

};