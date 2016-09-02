module.exports = function(server) {

  let AppIds = server.models['appids'],
    async = require('async'),
    config = server.config,
    express = require('express'),
    i18next = server.i18next,
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
      let err = new Error(i18next.t('server.400.invalidParameter', { parameter: "numOfIds", type: "number"}));
      err.status = 400;
      //cb((new RichError('server.400.invalidParameter', {i18next: { parameter: "numOfIds", type: "number" }})).toObject());
      //cb(new Error('server.400.invalidParameter'));
      respond(err, msg.id, cb);
    } else if(numOfIds > maxNumOfIds) {
      let err = new Error(i18next.t('server.400.maxNumOfIdsInCreatedExceeded', {maxNumOfIds: maxNumOfIds, numOfIds: numOfIds}));
      err.status = 400;
      respond(err, msg.id, cb);
      //cb((new RichError('server.400.maxNumOfIdsInCreatedExceeded', { i18next: { maxNumOfIds: maxNumOfIds, numOfIds: numOfIds }, referenceData: ids })).toObject());
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
        let reply = riposte.createReply({ id: msg.id });
        reply.addErrorsAndSetData(errors, results, function (err) {
          if(err) {
            cb(err);
          } else {
            respond(undefined, reply, cb);
          }
        });
      }, retries);
    }
  });

  seneca.wrap('service:maids,model:appids', function (msg, cb) {
    log.info('[%s] ACT service: maids, model: appids\nMessage:%s', msg.id, JSON.stringify(msg, undefined, 2));

    if( ! msg.access_token) {  //TODO: Verify access token is the process.env.PYLON_ACCESS_TOKEN
      let err = new Error(i18next.t('server.400.unauthorized'));  //TODO: Convert to Rich Error.
      err.status = 401;
      respond(err, msg.id, cb);
    } else {
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

    if(typeof reply === 'string') {
      reply = riposte.createReply({ id: reply });
    }

    tasks.push((next) => {
      if(err) {
        reply.addErrors(err, function (err) {
          if (err) {
            next(err);
          } else {
            next(undefined, reply);
          }
        });
      } else {
        next(undefined, reply);
      }
    });
    
    tasks.push((reply, next) => {
      reply.toObject(undefined, next);
    });

    async.waterfall(tasks, function(err, obj) {
      if(err) {
        log.error(err);
      }
      if(obj) {
        log.info('[%s] Reply with Status Code: %s\nBody: %s', obj.id, obj.status, JSON.stringify(obj, undefined, 2));
      }
      cb(null, obj);
    });
  }

};