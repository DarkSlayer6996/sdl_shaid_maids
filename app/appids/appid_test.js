module.exports = function(server) {

  let app = server.app,
    config = server.config,
    cql = server.cql,
    log = server.log;

  let assert = require('assert'),
    async = require('async'),
    i18n = require('i18next'),
    should = require('should'),
    _ = require('lodash');


  let adminAccessToken = "1",
    adminUserId = "1";


  /* ************************************************** *
   * ******************** Private Helper Methods
   * ************************************************** */


  let compareAppIds = function(actualAppIds, expectedAppIds, cb) {
    for(let i = 0; i < expectedAppIds.length; i++) {
      compareAppId(actualAppIds[i], expectedAppIds[i]);
    }
    cb();
  };

  let compareAppId = function(actual, expected) {
    if(expected.createdBy !== undefined) {
      assert.equal(actual.createdBy, expected.createdBy);
    }

    if(expected.id !== undefined) {
      assert.equal(actual.id, expected.id);
    }

    if(expected.isGenerated !== undefined) {
      assert.equal(actual.isGenerated, expected.isGenerated);
    }

    assert.equal(new Date(actual.createdOn) instanceof Date, true);
  };

  let validateDuplicateAppIdErrors = function(res, ids, cb) {
    assert(res, true);
    assert(res.body, true);
    assert(res.body.errors, true);
    assert(_.isArray(res.body.errors), true);
    assert(res.body.errors.length >= ids.length, true);

    for(let i = 0; i < ids.length; i++) {
      validateLocaleError(res.body.errors[i], 'server.400.duplicateAppId', {id: ids[i]});
    }
    if(cb) {
      cb();
    }
  };

  let validateInvalidParameter = function(res, parameter, type, cb, index = 0) {
    assert(res, true);
    assert(res.body, true);
    assert(res.body.errors, true);
    assert(_.isArray(res.body.errors), true);
    assert(res.body.errors.length > index, true);
    validateLocaleError(res.body.errors[index], 'server.400.invalidParameter', { parameter: parameter, type: type });
    if(cb) {
      cb();
    }
  };

  let validateMissingRequiredParameter = function(res, parameter, cb, index = 0) {
    assert(res, true);
    assert(res.body, true);
    assert(res.body.errors, true);
    assert(_.isArray(res.body.errors), true);
    assert(res.body.errors.length > index, true);
    validateLocaleError(res.body.errors[index], 'server.400.duplicateAppId', {parameter: parameter});
    if(cb) {
      cb();
    }
  };

  let validateMaxNumOfIdsInRegisterExceeded = function(res, numOfIds, maxNumOfIds, cb, index = 0) {
    assert(res, true);
    assert(res.body, true);
    assert(res.body.errors, true);
    assert(_.isArray(res.body.errors), true);
    assert(res.body.errors.length > index, true);
    validateLocaleError(res.body.errors[index], 'server.400.maxNumOfIdsInRegisterExceeded', { numOfIds: numOfIds, maxNumOfIds: maxNumOfIds});
    if(cb) {
      cb();
    }
  };

  let validateMaxNumOfIdsInCreateExceeded = function(res, numOfIds, maxNumOfIds, cb, index = 0) {
    assert(res, true);
    assert(res.body, true);
    assert(res.body.errors, true);
    assert(_.isArray(res.body.errors), true);
    assert(res.body.errors.length > index, true);
    validateLocaleError(res.body.errors[index], 'server.400.maxNumOfIdsInCreatedExceeded', { numOfIds: numOfIds, maxNumOfIds: maxNumOfIds});
    if(cb) {
      cb();
    }
  };

  let validateLocaleError = function(error, locale, localeOptions) {
    assert(error.code, locale.toLowerCase());
    assert(error.messageData, localeOptions);
    assert(error.message, i18n.t(locale, localeOptions));
  };


  /* ************************************************** *
   * ******************** Test Cases
   * ************************************************** */

  describe("AppIds", function() {

    afterEach(function (done) {
      this.timeout(0);
      cql.truncateModels(done);
    });


    /* ************************************************** *
     * ******************** Register
     * ************************************************** */

    describe("can be registered", function () {

      it("if the single application ID doesn't already exist", function (done) {
        let expectedAppIds = [{
          createdBy: adminUserId,
          id: "1",
          isGenerated: false
        }];

        let ids = expectedAppIds.map(function (appId) {
          return appId.id;
        });

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: ids })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(end);
      });

      it("if multiple application IDs don't already exist", function (done) {
        let expectedAppIds = [{
          createdBy: adminUserId,
          id: "1",
          isGenerated: false
        }, {
          createdBy: adminUserId,
          id: "2",
          isGenerated: false
        }, {
          createdBy: adminUserId,
          id: "3",
          isGenerated: false
        }];

        let ids = expectedAppIds.map(function (appId) {
          return appId.id;
        });

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: ids })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(end);
      });

    });
    
    describe("cannot be registered", function () {

      it("if the application ID already exist", function (done) {
        let existingAppIds = ["1"];

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            done();
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids/register')
              .send({ ids: existingAppIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: existingAppIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

      it("if multiple application IDs already exist", function (done) {
        let existingAppIds = ["1", "2", "3"];

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            done();
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids/register')
              .send({ ids: existingAppIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: existingAppIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

      it("if the ids parameter is missing", function (done) {
        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateMissingRequiredParameter(res, "ids", done);
          }
        };

        app.post('/maids/0/appids/register')
          .send()
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(400)
          .end(end);
      });

      it("if the ids parameter is invalid", function (done) {
        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateMissingRequiredParameter(res, "ids", done);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: 1 })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(400)
          .end(end);
      });

      it("if the number of IDs is too large", function (done) {
        let ids = [],
          maxNumOfIds = config.get('appIds.maxNumOfIdsInRegister');

        for(let i = 0; i <= maxNumOfIds; i++) {
          ids.push(i.toString());
        }

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateMaxNumOfIdsInRegisterExceeded(res, ids.length, maxNumOfIds, done);
          }
        };

        app.post('/maids/0/appids/register')
          .send()
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(400)
          .end(end);
      });

    });
    
    describe("can have some register and some fail to register", function() {

      it("if one of the application IDs already exist", function (done) {
        let existingAppIds = ["1"],
          expectedAppIds = [{
            createdBy: adminUserId,
            id: "2",
            isGenerated: false
          }, {
            createdBy: adminUserId,
            id: "3",
            isGenerated: false
          }],
          newAppIds = expectedAppIds.map(function (appId) {
            return appId.id;
          }),
          allAppIds = existingAppIds.concat(newAppIds);

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids/register')
              .send({ ids: allAppIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: existingAppIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

      it("if multiple of the application IDs already exist", function (done) {
        let existingAppIds = ["1", "2"],
          expectedAppIds = [{
            createdBy: adminUserId,
            id: "3",
            isGenerated: false
          }, {
            createdBy: adminUserId,
            id: "4",
            isGenerated: false
          }],
          newAppIds = expectedAppIds.map(function (appId) {
            return appId.id;
          }),
          allAppIds = existingAppIds.concat(newAppIds);

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids/register')
              .send({ ids: allAppIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ ids: existingAppIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

    });


    /* ************************************************** *
     * ******************** Create
     * ************************************************** */

    describe("can be created", function () {

      it("if the request is for a single application ID", function (done) {
        let expectedAppIds = [],
          numOfIds = 1;

        for(let i = 0; i < numOfIds; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        app.post('/maids/0/appids')
          .send()
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(end);
      });

      it("if multiple application IDs don't already exist", function (done) {
        let expectedAppIds = [],
          numOfIds = 5;

        for(let i = 0; i < numOfIds; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        app.post('/maids/0/appids')
          .send({ numOfIds: numOfIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(end);
      });

      it("if the generated application ID already exist", function (done) {
        let expectedAppIds = [],
          existingAppIds = ["1"],
          numOfIds = 1;

        for(let i = 0; i < numOfIds; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            for(let i = 0; i < existingAppIds.length; i++) {
              assert.notEqual(res.body.response[i], existingAppIds[i]);
            }
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids')
              .send({ ids: existingAppIds, numOfIds: numOfIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(200)
              .end(end);
          }
        };

        app.post('/maids/0/appids')
          .send({ ids: existingAppIds, numOfIds: existingAppIds.length})
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

      it("if multiple generated application IDs already exist", function (done) {
        let expectedAppIds = [],
          existingAppIds = ["1", "2"],
          numOfIds = 4;

        for(let i = 0; i < numOfIds; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            for(let i = 0; i < existingAppIds.length; i++) {
              assert.notEqual(res.body.response[i], existingAppIds[i]);
            }
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids')
              .send({ ids: existingAppIds, numOfIds: numOfIds })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(200)
              .end(end);
          }
        };

        app.post('/maids/0/appids')
          .send({ ids: existingAppIds, numOfIds: existingAppIds.length})
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

    });

    describe("cannot be created", function () {

      it("if the generated application ID exists too many times", function (done) {
        let expectedAppIds = [],
          existingAppIds = ["1"],
          numOfIds = 1;

        for(let i = 0; i < numOfIds-existingAppIds.length; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids')
              .send({ ids: existingAppIds, numOfIds: numOfIds, retries: 0 })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids')
          .send({ ids: existingAppIds, numOfIds: existingAppIds.length})
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });

      it("if multiple generated application ID exists too many times", function (done) {
        let expectedAppIds = [],
          existingAppIds = ["1", "2"],
          numOfIds = 5;

        for(let i = 0; i < numOfIds-existingAppIds.length; i++) {
          expectedAppIds.push({
            createdBy: adminUserId,
            isGenerated: true
          });
        }

        let end = function (err, res) {
          if (err) {
            done(err);
          } else {
            validateDuplicateAppIdErrors(res, existingAppIds);
            compareAppIds(res.body.response, expectedAppIds, done);
          }
        };

        let createAppIdCallback = function (err, res) {
          if (err) {
            done(err);
          } else {
            app.post('/maids/0/appids')
              .send({ ids: existingAppIds, numOfIds: numOfIds, retries: 0 })
              .set("Authorization", adminAccessToken)
              .expect("Content-Type", /json/)
              .expect(400)
              .end(end);
          }
        };

        app.post('/maids/0/appids')
          .send({ ids: existingAppIds, numOfIds: existingAppIds.length})
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(200)
          .end(createAppIdCallback);
      });
      
      it("if the numOfIds parameter is invalid", function (done) {
        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateInvalidParameter(res, "numOfItems", "number", done);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ numOfItems: "abc" })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(400)
          .end(end);
      });

      it("if the number of IDs to be created is too large", function (done) {
        let maxNumOfIds = config.get('appIds.maxNumOfIdsInCreate'),
          numOfIds = maxNumOfIds+1;

        let end = function (err, res) {
          if(err) {
            done(err);
          } else {
            validateMaxNumOfIdsInCreateExceeded(res, numOfIds, maxNumOfIds, done);
          }
        };

        app.post('/maids/0/appids/register')
          .send({ numOfIds: numOfIds })
          .set("Authorization", adminAccessToken)
          .expect("Content-Type", /json/)
          .expect(400)
          .end(end);
      });

    });

  });

};