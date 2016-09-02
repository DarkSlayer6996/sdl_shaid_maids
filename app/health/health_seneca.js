module.exports = function(server) {


  let async = require('async'),
    config = server.config,
    express = require('express'),
    i18next = server.i18next,
    log = server.log,
    riposte = server.riposte,
    seneca = server.seneca;

  const API_TOKEN_MAIDS = process.env.API_TOKEN_MAIDS || config.get('apiTokens.maids');


  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  seneca.add('service:maids,model:health,method:find', function (msg, cb) {
    let reply = riposte.createReply({ id: msg.id });
    reply.setData({ "status": 200 });

    respond(undefined, reply, cb);
  });

  seneca.wrap('service:maids,model:health', function (msg, cb) {
    log.info('[%s] ACT service: maids, model: appids\nMessage:%s', msg.id, JSON.stringify(msg, undefined, 2));

    if( ! msg.access_token || msg.access_token !== API_TOKEN_MAIDS) {
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