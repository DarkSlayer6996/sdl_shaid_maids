module.exports = function(server) {


  let async = require('async'),
    config = server.config,
    express = require('express'),
    i18next = server.i18next,
    log = server.log,
    npmConfig = server.npmConfig,
    riposte = server.riposte,
    seneca = server.seneca;

  const API_TOKEN_MAIDS = process.env.API_TOKEN_MAIDS || config.get('apiTokens.maids');


  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  seneca.add('service:maids,model:health,method:status', function (msg, cb) {
    riposte.createReply({ id: msg.id }).addAndSend(undefined, { "status": 200 }, cb);
  });

  seneca.add('service:maids,model:health,method:version', function (msg, cb) {
    riposte.createReply({ id: msg.id }).addAndSend(undefined, { "version": npmConfig.version }, cb);
  });

  seneca.wrap('service:maids,model:health', function (msg, cb) {
    log.info('[%s] ACT service: maids, model: appids\nMessage:%s', msg.id, JSON.stringify(msg, undefined, 2));

    if( ! msg.access_token || msg.access_token !== API_TOKEN_MAIDS) {
      let err = remie.create("server.400.unauthorized");
      riposte.createReply({ id: msg.id }).addErrorsAndSend(err, cb);
    } else {
      delete msg.access_token;
      this.prior(msg, cb);
    }
  });

};