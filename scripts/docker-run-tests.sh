#!/usr/bin/env bash

docker run --name maids -e "DB_PASSWORD=$CASSANDRA_DB_PASSWORD" smartdevicelink/shaid-maids:$CIRCLE_TAG