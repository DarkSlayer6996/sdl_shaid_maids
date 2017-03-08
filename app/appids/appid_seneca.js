module.exports = function(server) {

  let AppIds = server.models['appids'],
    async = require('async'),
    config = server.config,
    log = server.log,
    remie = server.remie,
    riposte = server.riposte,
    seneca = server.seneca,
    _ = require('lodash');

  const PATTERN_BASE = 'service:maids,model:appids,method:';

  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  seneca.add(PATTERN_BASE+'register', function (msg, cb) {
    let createdBy = msg.user.id,
      ids = msg.ids,
      maxNumOfIds = config.appIds.maxNumOfIdsInRegister;

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
      maxNumOfIds = config.appIds.maxNumOfIdsInCreate,
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

      if (config.appIds.canSetRetriesInCreateAppIds) {
        retries = msg.retries;
      }

      if (config.appIds.canSetAppIdsInCreateAppIds && msg.ids !== undefined) {
        for (let i = 0; i < numOfIds; i++) {
          let columns = {
            createdBy: createdBy,
            isGenerated: true
          };
          if (msg.ids && i < msg.ids.length) {
            columns.id = msg.ids[i];
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

    if( ! msg.access_token || msg.access_token !== config.apiTokens.maids) {
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
