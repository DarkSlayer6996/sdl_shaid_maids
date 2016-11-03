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

  const PATTERN_REGISTER_V0 = {
    access_token: API_TOKEN_MAIDS,
    id: "1",
    ids: [],
    method: "register",
    model: "appids",
    service: "maids",
    user: { id: adminUserId },
    version: 0
  };

  const PATTERN_CREATE_V0 = {
    access_token: API_TOKEN_MAIDS,
    id: "1",
    method: "create",
    model: "appids",
    numOfIds: undefined,
    service: "maids",
    user: { id: adminUserId },
    version: 0
  };

  let getRegisterPattern = function(version = 0) {
    switch(version) {
      default:
        return JSON.parse(JSON.stringify(PATTERN_REGISTER_V0));
    }
  };

  let getCreatePattern = function(version = 0) {
    switch(version) {
      default:
        return JSON.parse(JSON.stringify(PATTERN_CREATE_V0));
    }
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
          //log.info("Compare appId[%s]: %s === %s", key, expected[key], actual[key]);
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

    if(pattern.method === "register") {
      expect(pattern.ids).to.be.a('array');
      for(let i = 0; i < pattern.ids.length; i++) {
        expected.push({
          createdBy: pattern.user.id,
          id: "" + pattern.ids[i],
          isGenerated: false
        });
      }
    } else if(pattern.method === "create") {
      let numOfids = pattern.numOfIds || 1;
      for(let i = 0; i < numOfids; i++) {
        let appId = {
          createdBy: pattern.user.id,
          isGenerated: true
        };

        if(pattern.ids && i < pattern.ids.length) {
          appId.id = pattern.ids[i];
        }
        expected.push(appId);
      }
    } else {
      throw new Error("Cannot create expected App ID for unhandled pattern method.");
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

  let vrCreateAppIds = function(err, pattern, res, cb) {
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

  let vrMaxNumOfIds = function(err, pattern, res, cb) {
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
      compareLocaleError(res.errors[0], 'server.400.maxNumOfIdsInRegisterExceeded', { numOfIds: (pattern.numOfIds) ? pattern.numOfIds : pattern.ids.length, maxNumOfIds: config.get('appIds.maxNumOfIdsInRegister') }, 400, next);
    });

    async.series(tasks, cb);
  };

  /*
  let vrMissingRequiredParameter = function(err, pattern, res, cb) {
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
      compareLocaleError(res.errors[0], 'server.400.maxNumOfIdsInRegisterExceeded', { numOfIds: pattern.ids.length, maxNumOfIds: config.get('appIds.maxNumOfIdsInRegister') }, 400, next);
    });

    async.series(tasks, cb);
  };
*/
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
        let pattern = getRegisterPattern();
        pattern.ids = [ "1" ];
        
        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

      it("if multiple application IDs don't already exist", function (done) {
        let pattern = getRegisterPattern();
        pattern.ids = [ "1","2","3" ];

        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

      it("if one or more of the application IDs are numbers", function (done) {
        let pattern = getRegisterPattern();
        pattern.ids = [ 1, "2", 3 ];

        seneca.act(pattern, function (err, res) {
          vrRegisterAppIds(err, pattern, res, done);
        });
      });

    });

    describe("cannot be registered", function () {

      it("if the application ID already exist", function (done) {
        let pattern = getRegisterPattern();
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
        let pattern = getRegisterPattern();
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
        let pattern = getRegisterPattern();
        pattern.ids = undefined;

        // Register the application IDs.
        seneca.act(pattern, function (err, res) {
          vrInvalidParameter(err, pattern, res, "ids", "array", done);
        });
      });

      it("if the ids parameter is invalid", function (done) {
        let pattern = getRegisterPattern();
        pattern.ids = 1;

        // Register the application IDs.
        seneca.act(pattern, function (err, res) {
          vrInvalidParameter(err, pattern, res, "ids", "array", done);
        });
      });

      it("if the number of IDs is too large", function (done) {
        let pattern = getRegisterPattern(),
          maxNumOfIds = config.get('appIds.maxNumOfIdsInRegister');

        for(let i = 0; i <= maxNumOfIds; i++) {
          pattern.ids.push(i.toString());
        }

        seneca.act(pattern, function (err, res) {
          vrMaxNumOfIds(err, pattern, res, done);
        });
      });

    });

    describe("can have some register and some fail to register", function() {

      it("if one of the application IDs already exist", function (done) {
        let pattern = getRegisterPattern(),
          patternOfDuplicates = getRegisterPattern();

        pattern.ids = [ "0", "1" ];
        patternOfDuplicates.ids = [ "1" ];

        let patternNoDuplicates = JSON.parse(JSON.stringify(pattern));

        // Remove duplicate ids from patternNoDuplicates list.
        for(let i = 0; i < patternOfDuplicates.ids.length; i++) {
          let index = patternNoDuplicates.ids.indexOf(patternOfDuplicates.ids[i]);
          if(index > -1) {
            patternNoDuplicates.ids.splice(index, 1);
          }
        }

        // Register the first application ID.
        seneca.act(patternOfDuplicates, function (err, res) {
          vrRegisterAppIds(err, patternOfDuplicates, res, function(err) {
            if(err) {
              done(err);
            } else {
              // Attempt to register both application IDs
              seneca.act(pattern, function(err, res) {
                if(err) {
                  return done(err);
                } else {
                  let tasks = [];

                  tasks.push(next => {
                    validateResponseStructure(res, next);
                  });

                  tasks.push(next => {
                    validateHttpStatusCode(res, (patternOfDuplicates.ids.length > 0) ? 400 : 200, next);
                  });

                  expect(res.errors).to.be.a('array');
                  assert(res.errors.length, patternOfDuplicates.ids.length, "Unexpected number of errors.");
                  for (let i = 0; i < res.errors.length; i++) {
                    tasks.push(next => {
                      compareLocaleError(res.errors[i], 'server.400.duplicateAppId', {id: patternOfDuplicates.ids[i]}, 400, next);
                    });
                  }

                  tasks.push(next => {
                    expect(res.data).to.be.a('array');
                    expect(res.data.length, patternNoDuplicates.ids.length, "Unexpected number of successfully registered AppIds.");
                    createExpectedAppIds(patternNoDuplicates, next);
                  });

                  tasks.push((expected, next) => {
                    compareAppIds(res.data, expected, next);
                  });

                  async.waterfall(tasks, done);
                }
              });
            }
          });
        });
      });

      it("if multiple of the application IDs already exist", function (done) {
        let pattern = getRegisterPattern(),
          patternOfDuplicates = getRegisterPattern();

        pattern.ids = ["0", "1", "2", "3", "4"];
        patternOfDuplicates.ids = ["1", "2", "3"];

        let patternNoDuplicates = JSON.parse(JSON.stringify(pattern));

        // Remove duplicate ids from patternNoDuplicates list.
        for (let i = 0; i < patternOfDuplicates.ids.length; i++) {
          let index = patternNoDuplicates.ids.indexOf(patternOfDuplicates.ids[i]);
          if (index > -1) {
            patternNoDuplicates.ids.splice(index, 1);
          }
        }

        // Register the first application ID.
        seneca.act(patternOfDuplicates, function (err, res) {
          vrRegisterAppIds(err, patternOfDuplicates, res, function (err) {
            if (err) {
              done(err);
            } else {
              // Attempt to register both application IDs
              seneca.act(pattern, function (err, res) {
                if (err) {
                  return done(err);
                } else {
                  let tasks = [];

                  tasks.push(next => {
                    validateResponseStructure(res, next);
                  });

                  tasks.push(next => {
                    validateHttpStatusCode(res, (patternOfDuplicates.ids.length > 0) ? 400 : 200, next);
                  });

                  expect(res.errors).to.be.a('array');
                  assert(res.errors.length, patternOfDuplicates.ids.length, "Unexpected number of errors.");
                  for (let i = 0; i < res.errors.length; i++) {
                    tasks.push(next => {
                      compareLocaleError(res.errors[i], 'server.400.duplicateAppId', {id: patternOfDuplicates.ids[i]}, 400, next);
                    });
                  }

                  tasks.push(next => {
                    expect(res.data).to.be.a('array');
                    expect(res.data.length, patternNoDuplicates.ids.length, "Unexpected number of successfully registered AppIds.");
                    createExpectedAppIds(patternNoDuplicates, next);
                  });

                  tasks.push((expected, next) => {
                    compareAppIds(res.data, expected, next);
                  });

                  async.waterfall(tasks, done);
                }
              });
            }
          });
        });
      });

    });


    /* ************************************************** *
     * ******************** Create
     * ************************************************** */

    describe("can be created", function () {

      it("if the request is for a single application ID", function (done) {
        let pattern = getCreatePattern();

        seneca.act(pattern, function (err, res) {
          vrCreateAppIds(err, pattern, res, done);
        });
      });

      it("if multiple application IDs don't already exist", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = 5;

        seneca.act(pattern, function (err, res) {
          vrCreateAppIds(err, pattern, res, done);
        });
      });

      it("if the generated application ID already exist", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = 1;
        pattern.ids = [ "1" ];

        // Create the application ID.
        seneca.act(pattern, function (err, res1) {
          vrCreateAppIds(err, pattern, res1, function(err) {
            if(err) {
              done(err);
            } else {
              // Register the same application ID to produce a duplicate ID error,
              // causing a new App ID to be generated..
              seneca.act(pattern, function (err, res2) {
                if (err) {
                  done(err);
                } else {

                  // Make sure new IDs were generated for the collisions.
                  for(let i = 0; i < pattern.ids.length; i++) {
                    assert.notEqual(res1.data[i].id, res2.data[i].id, "Collision of IDs when using create should be different.");
                  }

                  // Remove the IDs we forced so they are not included as the expected App ID value.
                  pattern.ids = undefined;
                  vrCreateAppIds(err, pattern, res2, done);
                }
              });
            }
          });
        });
      });

      it("if multiple generated application IDs already exist", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = 4;
        pattern.ids = [ "1", "2", "3" ];

        // Create the application ID.
        seneca.act(pattern, function (err, res1) {
          vrCreateAppIds(err, pattern, res1, function(err) {
            if(err) {
              done(err);
            } else {
              // Register the same application ID to produce a duplicate ID error,
              // causing a new App ID to be generated..
              seneca.act(pattern, function (err, res2) {
                if (err) {
                  done(err);
                } else {

                  // Make sure new IDs were generated for the collisions.
                  for(let i = 0; i < pattern.ids.length; i++) {
                    assert.notEqual(res1.data[i].id, res2.data[i].id, "Collision of IDs when using create should be different.");
                  }

                  // Remove the IDs we forced so they are not included as the expected App ID value.
                  pattern.ids = undefined;
                  vrCreateAppIds(err, pattern, res2, done);
                }
              });
            }
          });
        });
      });

    });

    describe("cannot be created", function () {

      it("if the generated application ID exists too many times", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = 1;
        pattern.ids = [ "1" ];
        pattern.retries = 0;

        // Create the application ID.
        seneca.act(pattern, function (err, res1) {
          vrCreateAppIds(err, pattern, res1, function(err) {
            if(err) {
              done(err);
            } else {
              seneca.act(pattern, function (err, res2) {
                vrDuplicateAppIds(err, pattern, res2, done);
              });
            }
          });
        });
      });

      it("if multiple generated application ID exists too many times", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = 3;
        pattern.ids = [ "1", "2", "3" ];
        pattern.retries = 0;

        // Create the application ID.
        seneca.act(pattern, function (err, res1) {
          vrCreateAppIds(err, pattern, res1, function(err) {
            if(err) {
              done(err);
            } else {
              seneca.act(pattern, function (err, res2) {
                vrDuplicateAppIds(err, pattern, res2, done);
              });
            }
          });
        });
      });

      it("if the numOfIds parameter is invalid", function (done) {
        let pattern = getCreatePattern();
        pattern.numOfIds = "5";

        seneca.act(pattern, function (err, res) {
          vrInvalidParameter(err, pattern, res, "numOfIds", "number", done);
        });
      });

      it("if the number of IDs to be created is too large", function (done) {
        let pattern = getCreatePattern(),
          maxNumOfIds = config.get('appIds.maxNumOfIdsInCreate');
        pattern.numOfIds = maxNumOfIds+1;

        seneca.act(pattern, function (err, res) {
          vrMaxNumOfIds(err, pattern, res, done);
        });
      });

    });

  });
};