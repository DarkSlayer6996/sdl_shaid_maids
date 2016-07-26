module.exports = function(defaultRichErrorConfig) {

  let guessStatusCodeOfLocale = function (locale) {
    switch (locale) {
      //case "server.400.badRequest":
      //  return 400;
      case "server.400.forbidden":
        return 403;
      case "server.400.notFound":
        return 404;
      case "server.400.unauthorized":
        return 401;
      default:
        let categories = locale.split(".");
        if (categories.length != 0) {
          if (categories[0] == "server") {
            return Number(categories[1]);
          }
        }
        return 500;
    }
  };

  class RichError {
    constructor(err, richErrorOptions, richErrorConfig) {
      this.setConfig(defaultRichErrorConfig);
      this.setConfig(richErrorConfig);
      this.build(err, richErrorOptions);
    }

    copy(err, options) {
      let self = this;

      self.options = err.options;
      self.error = err.error;
      self.statusCode = err.statusCode;
      self.internalOnly = err.internalOnly;
      self.referenceData = err.referenceData;

      return self;
    }

    buildFromSystemError(err, options) {
      let self = this;
      if (err instanceof Error) {
        self.error = err;
        self.error.code = (err.code) ? err.code.toLowerCase() : undefined;
        self.statusCode = options.statusCode || 500;
      }
    }

    buildFromLocale(locale, options) {
      let self = this;
      self.error = new Error(self.i18next.t(locale, options.i18next));
      self.error.code = locale.toLowerCase();
      self.messageData = options.i18next;
      self.statusCode = options.statusCode || guessStatusCodeOfLocale(locale);
    }

    buildFromString(errorString, options) {
      let self = this;
      self.error = new Error(errorString);
      self.error.code = (options.code) ? options.code.toLowerCase() : undefined;
      self.statusCode = options.statusCode || 500;
    }

    static buildInternal(err, options = {}, richErrorConfig) {
      options.internalOnly = true;
      new RichError(err, options, richErrorConfig);
    }

    build(err, options = {}) {
      let self = this;

      if(err === undefined && options.internalMessage == undefined) {
        return undefined;
      } else {
        if (err instanceof RichError) {
          self.copy(err, options);
        } else {
          self.options = options;

          if (err instanceof Error) {
            self.buildFromSystemError(err, options);
          } else if (self.i18next && self.i18next.exists(err)) {
            self.buildFromLocale(err, options);
          } else {
            self.buildFromString(err, options);
          }

          self.internalMessage = (options.internalMessage) ? options.internalMessage : undefined;
          self.internalOnly = (options.internalOnly === true) ? true : false;
          self.referenceData = (options.referenceData !== undefined) ? options.referenceData : undefined;
        }

        return self;
      }
    }

    get(key) {
      let self = this;

      switch (key) {
        case "code":
          return (self.error) ? self.error[key] : undefined;
        default:
          return self[key];
      }
    }

    toObject() {
      let self = this;

      if ( ! self.error) {
        return undefined;
      } else {
        let err = {};

        if (self.error.message) {
          err.message = self.error.message;
        }

        if (self.error.code) {
          err.code = self.error.code;
        }

        if (self.referenceData) {
          err.referenceData = self.referenceData;
        }

        if(self.messageData) {
          err.messageData = self.messageData;
        }

        if (this.enableStackTrace) {
          err.stack = self.error.stack;
        }

        return err;
      }
    }

    setConfig(richErrorConfig) {
      if(richErrorConfig) {
        if(richErrorConfig.i18next) {
          this.i18next = richErrorConfig.i18next;
        }

        if(richErrorConfig.config) {
          if(richErrorConfig.config.has('richError.enableStackTrace')) {
            let enableStackTrace = richErrorConfig.config.get('richError.enableStackTrace');
            if(enableStackTrace === true || enableStackTrace === false) {
              this.enableStackTrace = enableStackTrace;
            }
          }
        }
      }
    }

    static setDefaultConfig(richErrorConfig) {
      defaultRichErrorConfig = richErrorConfig;
      return RichError;
    }

  }

  return RichError;
};