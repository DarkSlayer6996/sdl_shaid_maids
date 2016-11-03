module.exports = function(server) {
  let app = server.app,
    config = server.config,
    cql = server.cql,
    log = server.log,
    seneca = server.seneca;

  let async = require('async'),
    chai = require('chai'),
    i18next = require('i18next'),
    _ = require('lodash');

  let assert = chai.assert,
    expect = chai.expect;

  const API_TOKEN_MAIDS = process.env.API_TOKEN_MAIDS || config.get('apiTokens.maids');

  let adminUserId = "1";


  /* ************************************************** *
   * ******************** Message Patterns
   * ************************************************** */

  let PATTERN_REGISTER_V0 = {
    access_token: API_TOKEN_MAIDS,
    id: "1",
    ids: [],
    method: "register",
    model: "appids",
    service: "maids",
    user: { id: adminUserId },
    version: 0
  };
  

  /* ************************************************** *
   * ******************** Private Helper Methods
   * ************************************************** */

  /**
   * Check if an application ID object has the same
   * fields and values as the expected application ID.
   */
  let compareAndValidateAppId = function(actual, expected, cb) {
    expect(actual).to.be.a('object');
    expect(actual.createdBy).to.be.a('string');
    expect(actual.id).to.be.a('string');
    expect(actual.isGenerated).to.be.a('boolean');
    assert.equal(new Date(actual.createdOn) instanceof Date, true);

    if(expected) {
      for(key in expected) {
        if(expected.hasOwnProperty(key)) {
          log.info("Compare appId[%s]: %s === %s", key, expected[key], actual[key]);
          assert.strictEqual(expected[key], actual[key], "Application ID !== "+key);
        }
      }
    }

    if (cb) {
      cb()
    }
  };

  /**
   * Check if an multiple application ID object have the
   * same fields and values as the expected application IDs.
   */
  let compareAppIds = function(actual, expected, cb) {
    cb = (cb) ? cb : function(err) { if(err) { throw err } };

    let tasks = [];
    if(expected) {
      for (let i = 0; i < expected.length; i++) {
        expect(actual).to.be.a('array');
        tasks.push( next => {
          compareAndValidateAppId(actual[i], expected[i], next);
        });
      }
    }
    async.parallel(tasks, cb);
  };

  let validateResponseStructure = function(res, cb) {
    expect(res).to.be.a('object');
    expect(res.id).to.be.a('string');
    expect(res.httpStatusCode).to.be.a('number');
    expect(res.httpStatusCode).to.be.at.least(100);
    expect(res.httpStatusCode).to.be.below(600);

    assert(res.data || res.errors, "Reply does not contain data or errors.");

    if(res.data) {
      expect(res.data).to.be.a('array');
      for(var i = 0; i < res.data.length; i++) {
        expect(res.data[i]).to.be.a('object');
      }
    }

    if(res.errors) {
      expect(res.errors).to.be.a('array');
      for(var i = 0; i < res.errors.length; i++) {
        expect(res.errors[i]).to.be.a('object');
      }
    }

    if(cb) {
      cb();
    }
  };

  let createExpectedAppIds = function(pattern, cb) {
    let expected = [];

    expect(pattern).to.be.a('object');

    if(pattern.ids) {
      for(let i = 0; i < pattern.ids.length; i++) {
        expected.push({
          createdBy: pattern.user.id,
          id: "" + pattern.ids[i],
          isGenerated: false
        });
      }
    }

    cb(undefined, expected);
  };

  let compareLocaleError = function(e, locale, localeOptions, httpStatusCode = 500, cb) {
    expect(e).to.be.a('object');
    expect(e.error).to.be.a('object');
    expect(e.error.message).to.be.a("string");
    expect(e.messageData).to.be.a("object");

    assert(e.error.code, locale.toLowerCase());
    assert(e.error.message, i18next.t(locale, localeOptions));
    assert(e.messageData, localeOptions);
    assert(e.httpStatusCode, httpStatusCode);
    expect(e.level).to.be.a('string');

    if(cb) {
      cb();
    }
  };

  let validateHttpStatusCode = function(res, expected, cb) {
    assert.strictEqual(res.httpStatusCode, expected || 200, "Http status code is unexpected.");
    if(cb) {
      cb();
    }
  };


  /* ************************************************** *
   * ******************** API Response Validation
   * ************************************************** */

  let vrRegisterAppIds = function(err, pattern, res, cb) {
    if(err) {
      return cb(err);
    }

    let tasks = [];

    tasks.push(next => {
      validateResponseStructure(res, next);
    });

    tasks.push(next => {
      validateHttpStatusCode(res, 200, next);
    });

    tasks.push(next => {
      createExpectedAppIds(pattern, next);
    });

    tasks.push((expected, next) => {
      compareAppIds(res.data, expected, next);
    });

    async.waterfall(tasks, cb);
  };

  let vrDuplicateAppIds = function(err, pattern, res, cb) {
    if(err) {
      return cb(err);
    }

    let tasks = [];

    tasks.push(next => {
      validateResponseStructure(res, next);
    });

    tasks.push(next => {
      validateHttpStatusCode(res, 400, next);
    });

    assert(res.errors.length, pattern.ids, "Unexpected number of errors returned");
    for(let i = 0; i < res.errors.length; i++) {
      tasks.push(next => {
        compareLocaleError(res.errors[i], 'server.400.duplicateAppId', {id: pattern.ids[i]}, 400, next);
      });
    }

    async.series(tasks, cb);
  };

  let vrInvalidParameter = function(err, pattern, res, parameter, type, cb) {
    if(err) {
      return cb(err);
    }

    let tasks = [];

    tasks.push(next => {
      validateResponseStructure(res, next);
    });

    tasks.push(next => {
      validateHttpStatusCode(res, 400, next);
    });

    assert(res.errors.length, 1, "Unexpected number of errors returned");
    tasks.push(next => {
      compareLocaleError(res.errors[0], 'server.400.invalidParameter', { parameter: parameter, type: type }, 400, next);
    });

    async.series(tasks, cb);
  };

  /*
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
*/



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
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = [ "1" ];
        
        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

      it("if multiple application IDs don't already exist", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = [ "1","2","3" ];

        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

      it("if one or more of the application IDs are numbers", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = [ 1, "2", 3 ];

        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

    });

    describe("cannot be registered", function () {

      it("if the application ID already exist", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = [ "1" ];

        // Register the application ID.
        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, function(err) {

            // Register the same application ID to produce a duplicate ID error.
            seneca.act(pattern, function(err, res) {
              vrDuplicateAppIds(err, pattern, res, done);
            });
          });
        });
      });

      it("if multiple application IDs already exist", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = [ "1","2","3" ];

        // Register the application IDs.
        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, function(err) {

            // Register the same application IDs to produce duplicate ID errors.
            seneca.act(pattern, function(err, res) {
              vrDuplicateAppIds(err, pattern, res, done);
            });
          });
        });
      });

      it("if the ids parameter is missing", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = undefined;

        // Register the application IDs.
        seneca.act(pattern, function (err, res) {
          vrInvalidParameter(err, pattern, res, "ids", "array", done);
        });
      });

      it("if the ids parameter is invalid", function (done) {
        let pattern = PATTERN_REGISTER_V0;
        pattern.ids = 1;

        // Register the application IDs.
        seneca.act(pattern, function (err, res) {
          vrInvalidParameter(err, pattern, res, "ids", "array", done);
        });
      });
/*
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
*/
    });
/*
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
     * ************************************************** *

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
*/
  });

};