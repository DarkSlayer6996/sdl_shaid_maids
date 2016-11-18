#!/usr/bin/env bash

docker run -d --name maids -e "NODE_ENV=test-circleci" smartdevicelink/shaid-maids:$CIRCLE_TAG
runTestCmd="cd /usr/src/app/ && DB_PASSWORD=$CASSANDRA_DB_PASSWORD NODE_ENV=test-circleci mocha"
sudo lxc-attach -n "$(docker inspect --format "{{.Id}}" maids)" -- bash -c "$runTestCmd"