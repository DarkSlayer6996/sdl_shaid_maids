module.exports = function(server) {
  
  let AppIds = server.models['appids'],
    app = server.app,
    config = server.config,
    express = require('express'),
    log = server.log,
    RichError = server.RichError,
    _ = require('lodash');

  const CAN_SET_APP_IDS_IN_CREATE_APP_IDS = (config.has('test.canSetAppIdsInCreateAppIds') && config.get('test.canSetAppIdsInCreateAppIds') === true) ? true : false,
    CAN_SET_RETRIES_IN_CREATE_APP_IDS = (config.has('test.canSetRetriesInCreateAppIds') && config.get('test.canSetRetriesInCreateAppIds') === true) ? true : false;

  /* ************************************************** *
   * ******************** API Routes and Permissions
   * ************************************************** */

  var api = express.Router();

  api.route('/register').post(validateAccessToken, registerAppIds);
  api.route('/').post(validateAccessToken, createAppId);

  app.use('/maids/:version/appids', api);


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

  function registerAppIds(req, res, next) {
    let createdBy = req.user.id,
      ids = req.body.ids || req.query.ids,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInRegister');

    if( ! ids || ! _.isArray(ids) || ids.length == 0) {
      next(new RichError("server.400.missingRequiredParameter", { i18next: { parameter: "ids" }, referenceData: req.body || req.query }));
    } else if(ids.length > maxNumOfIds) {
      next(new RichError('server.400.maxNumOfIdsInRegisterExceeded', { i18next: { maxNumOfIds: maxNumOfIds, numOfIds: ids.length }, referenceData: ids }));
    } else {
      let appIds = [];
      for(let i = 0; i < ids.length; i++) {
        appIds.push(AppIds.create({ id: ids[i], createdBy: createdBy }));
      }

      AppIds.insert(appIds, function (errors, results) {
        res.addErrors(errors);
        res.setData(results, next);
      });
    }
  }

  function createAppId(req, res, next) {
    let createdBy = req.user.id,
      maxNumOfIds = config.get('appIds.maxNumOfIdsInCreate'),
      numOfIds = req.body.numOfIds || req.query.numOfIds || 1;

    if( ! _.isFinite(numOfIds)) {
      next(new RichError('server.400.invalidParameter', {i18next: { parameter: "numOfIds", type: "number" }}));
    } else if(numOfIds > maxNumOfIds) {
      next(new RichError('server.400.maxNumOfIdsInCreatedExceeded', { i18next: { maxNumOfIds: maxNumOfIds, numOfIds: numOfIds }, referenceData: ids }));
    } else {
      let appIds = [],
        retries;

      if(CAN_SET_RETRIES_IN_CREATE_APP_IDS) {
        retries = req.body.retries;
      }

      if(CAN_SET_APP_IDS_IN_CREATE_APP_IDS && req.body.ids !== undefined) {
        for (let i = 0; i < numOfIds; i++) {
          let columns = {
            createdBy: createdBy,
            isGenerated: true
          };
          if(req.body.ids && i < req.body.ids.length) {
            columns.id = req.body.ids[i];
          }
          appIds.push(AppIds.create(columns));
        }
      } else {
        appIds = AppIds.create({ createdBy: createdBy }, numOfIds);
      }
      
      AppIds.insert(appIds, function (errors, results) {
        res.addErrors(errors);
        res.setData(results, next);
      }, retries);
    }
  }

};