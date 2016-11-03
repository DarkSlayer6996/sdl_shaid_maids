module.exports = function(server) {

  let AppIds = server.models['appids'],
    async = require('async'),
    config = server.config,
    log = server.log,
    remie = server.remie,
    riposte = server.riposte,
    seneca = server.seneca,
    _ = require('lodash');

  const CAN_SET_APP_IDS_IN_CREATE_APP_IDS = (config.has('test.canSetAppIdsInCreateAppIds') && config.get('test.canSetAppIdsInCreateAppIds') === true) ? true : false,
    CAN_SET_RETRIES_IN_CREATE_APP_IDS = (config.has('test.canSetRetriesInCreateAppIds') && config.get('test.canSetRetriesInCreateAppIds') === true) ? true : false,
    PATTERN_BASE = 'service:maids,model:appids,method:';

  const API_TOKEN_MAIDS = process.env.API_TOKEN_MAIDS || config.get('apiTokens.maids');
  
  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  seneca.add(PATTERN_BASE+'register', function (msg, cb) {
    let createdBy = msg.user.id,
      ids = msg.ids,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInRegister');

    if( ! ids || ! _.isArray(ids) || ids.length == 0) {
      let err = remie.create("server.400.missingRequiredParameter", {
        messageData: {
          parameter: "ids"
        },
        referenceData: msg.ids
      });
      riposte.createReply({ id: msg.id }).addErrorsAndSend(err, cb);
    } else if(ids.length > maxNumOfIds) {
      let err = remie.create("server.400.maxNumOfIdsInRegisterExceeded", {
        messageData: {
          maxNumOfIds: maxNumOfIds,
          numOfIds: ids.length
        },
        referenceData: ids
      });
      riposte.createReply({ id: msg.id}).addErrorsAndSend(err, cb);
    } else {
      let appIds = [];
      for(let i = 0; i < ids.length; i++) {
        if(ids[i])
        appIds.push(AppIds.create({ id: ids[i], createdBy: createdBy }));
      }

      AppIds.insert(appIds, function (errors, results) {
        riposte.createReply({ id: msg.id }).addAndSend(errors, results, cb);
      });
    }
  });

  seneca.add(PATTERN_BASE+'create', function (msg, cb) {
    let createdBy = msg.user.id,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInCreate'),
      numOfIds = msg.numOfIds || 1;

    if( ! _.isFinite(numOfIds)) {
      let err = remie.create("server.400.invalidParameter", {
        messageData: {
          parameter: "numOfIds",
          type: "number"
        }
      });
      riposte.createReply({ id: msg.id }).addErrorsAndSend(err, cb);
    } else if(numOfIds > maxNumOfIds) {
      let err = remie.create("server.400.maxNumOfIdsInCreatedExceeded", {
        messageData: {
          maxNumOfIds: maxNumOfIds,
          numOfIds: numOfIds
        }
      });
      riposte.createReply({ id: msg.id }).addErrorsAndSend(err, cb);
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
        riposte.createReply({ id: msg.id }).addAndSend(errors, results, cb);
      }, retries);
    }
  });

  seneca.wrap('service:maids,model:appids', function (msg, cb) {
    log.info('[%s] ACT service: maids, model: appids\nMessage:%s', msg.id, JSON.stringify(msg, undefined, 2));

    if( ! msg.access_token || msg.access_token !== API_TOKEN_MAIDS) {
      let err = remie.create("server.400.unauthorized", {
        internalMessage: "Access token is missing or invalid."
      });
      riposte.createReply({ id: msg.id }).addErrorsAndSend(err, cb);
    } else {
      delete msg.access_token;
      this.prior(msg, cb);
    }
  });

};