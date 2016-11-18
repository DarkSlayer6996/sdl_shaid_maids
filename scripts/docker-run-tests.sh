#!/usr/bin/env bash

docker run -d --name maids --net=host -e "DB_PASSWORD=$CASSANDRA_DB_PASSWORD" smartdevicelink/shaid-maids:$CIRCLE_TAG
cmd="cd /usr/src/app/ && DB_PASSWORD=$CASSANDRA_DB_PASSWORD npm run-script test-circleci"
sudo lxc-attach -n "$(docker inspect --format "{{.Id}}" maids)" -- bash -c "$cmd"