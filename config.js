let configSettings = {
    "environment": process.env.NODE_ENV || "development",

    "apiTokens": {                              // Listing of API tokens used by maids.
        "maids": process.env.API_TOKEN_MAIDS || "development-only-token"       // API token accepted by other services attempting to use maids.
    },

    "appIds": {                                 // Configurations for application IDs.
        "maxNumOfIdsInRegister": parseInt(process.env.MAX_REGISTER_IDS) || 50,      // Maximum number of App IDs that can be registered in a single request.
        "maxNumOfIdsInCreate": parseInt(process.env.MAX_CREATE_IDS) || 50,          // Maximum number of App IDs that can be generated in a single request.
        "maxGenRetry": parseInt(process.env.MAX_GEN_RETRY) || 3,                    // Maximum number of times to retry generation of a unique App ID.
        "canSetAppIdsInCreateAppIds": process.env.CAN_SET_IDS_IN_CREATE == "true" ? true : false,     // When true, the request can include specific application IDs to count as generated.
        "canSetRetriesInCreateAppIds": process.env.CAN_SET_RETRIES_IN_CREATE == "true" ? true : false // When true, the request can include how many retry attempts to use when generating application IDs.
    },

    "cassandra": {                              // Configure the Cassandra client.  See http://goo.gl/OwXliW for more info.
        "dropKeyspaceOnInit": false,            // When true, the keyspace(s) will be cleared on every initialization.  Resulting in an empty database on every server restart.
        "contactPoints": process.env.CASSANDRA_CONTACTS ? process.env.CASSANDRA_CONTACTS.split(",") : ["localhost"],         // Array of addresses or host names of the Cassandra nodes to add as contact points.
        "durableWrites": process.env.CASSANDRA_DURABLE_WRITES == "false" ? false : true,    // When set to false, data written to the keyspace bypasses the commit log.  Be careful using this option because you risk losing data.  Must be true when using replication class "SimpleStrategy".
        "keyspace": process.env.CASSANDRA_MAIDS_KEYSPACE || "sdl_shaid_maids",  // Name of the top-level namespace used by the application.  Similar to a database name.
        "replication": process.env.CASSANDRA_REPLICATION ? JSON.parse(process.env.CASSANDRA_REPLICATION) : {                        // Configure cassandra replication for the keyspace specified, see https://goo.gl/zFFJiv
            "class": "SimpleStrategy",          // Required. The name of the replica placement strategy class for the new keyspace.
            "replication_factor": 1             // Required if class is SimpleStrategy; otherwise, not used. The number of replicas of data on multiple nodes.
        }
    },

    "crave": {                                  // Crave is a module used to find and require files dynamically.  https://github.com/ssmereka/crave
        "cache": {                              // Configure caching of the list of files to require.
            "enable": false                     // Disable caching of the list of files to load.  In production this should be enabled.
        },
        "identification": {                     // Configure how to find and require files.
            "type": "filename",                 // Determines how to find files.  Available options are: 'string', 'filename'
            "identifier": "_"                   // Determines how to identify the files.
        }
    },

    "express": {                                // Configure the express routing framework.  http://expressjs.com/
        "static": {                             // Default configurations for express.static
            "maxAge": parseInt(process.env.STATIC_MAX_AGE) || 0     // Set the max-age property of the Cache-Control header in milliseconds or a string in ms format.  Default is value is 0 and max is 365 days.  In production this needs to be greater than zero to leverage browser caching.
        }
    },

    "i18n": {                                   // i18next handles multiple language support.  http://goo.gl/uVfbtv or https://goo.gl/whiiEW
        "backend": {                            // Options for the backend, see https://goo.gl/KwzOWb or http://goo.gl/8JXuyW
            "addPath": "./locales/{{lng}}/{{ns}}.mission.json", // Path to post missing resources.
            "jsonIndent": 2,                    // Intent to use when storing JSON files.
            "loadPath": "./locales/{{lng}}/{{ns}}.json" // Path where resources get loaded from.
        },
        "debug": false,                         // Adds a bunch of debug text for i18next. Good for debugging why translations are failing.
        "fallbackLng": ["en-us"],               // Default language selection.
        "useCookie": false                      // Do not use custom i18next cookie for language translation.
    },

    "log": {                                    // Configure the log module.
        "consoleLogLevel": process.env.LOG_LEVEL || "trace",             // Set the bunyan log level, see https://goo.gl/zNyG1C
        "databaseLogLevel": false,              // Set the database log level.  Logging to a database is disabled when this is undefined or false
        "bunyan-dynamo": {                      // Configurations for the bunyan-dynamo module, see https://goo.gl/BqIS1t
            "aws": {                            // Configurations for the AWS SDK used in bunyan-dynamo.  https://github.com/aws/aws-sdk-js
                "profile": "default",           // Local settings and security profile to use, default value is "default".
                "region": "us-east-1"           // Region to connect to, default value is "us-east-1".
            },
            "type": "dynamodb"                  // Type of database to store logs in.  Only current option is DynamoDB.
        },
        //"name": "shaid-maids"                 // Name of the logger, defaults to application name if undefined.
        "logAllRequests": true,                 // Enable trace logging of all requests the server receives.
        "logAllResponses": true                 // Enable trace logging of all responses the server sends.
    },

    "richError": {                              // Configure the RichError library.
        "enableStackTrace": process.env.OUTPUT_STACK_TRACE == "true" ? true : false    // When true, errors returned from the server will include a stack trace.
    },

    "seneca": {
        "host": process.env.MAIDS_HOSTNAME || "localhost",
        "type": "http",
        "pin": "service:maids",
        "port": parseInt(process.env.MAIDS_PORT) || 5002,
        "timeout": 10000
    },

    "server": {                                 // Settings for the Node server.
        "AllowCors": true,                      // When true, allow Cross-Origin Resource Sharing (CORS).
        "domainName": process.env.HOSTNAME || "localhost",      // Domain name used to reach the server.  (e.g. my.website.com)
        "name": "shaid-maids",                  // Name of the server.
        "port": parseInt(process.env.PORT) || 3000,             // Port the server will be listening on.
        "protocol": "http"                      // Protocol used to reach the server. (e.g. http or https)
        //"url": "http://localhost:3000         // Full URL used to reach the server.  If undefined, it will be created using the domainName, protocol, and port.
    }
};

module.exports = configSettings;
