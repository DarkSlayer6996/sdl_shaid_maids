#!/usr/bin/env bash

docker run --name maids --net=host -e "DB_PASSWORD=$CASSANDRA_DB_PASSWORD" smartdevicelink/shaid-maids:123456789